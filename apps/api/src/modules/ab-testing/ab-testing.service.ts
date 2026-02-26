import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ExperimentEventType, ExperimentStatus, ExperimentTarget } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID, createHash } from "node:crypto";

type AssignmentCookie = {
  id: string;
  assignments: Record<string, string>;
};

function hashToFloat(input: string) {
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 8);
  const num = parseInt(hash, 16);
  return num / 0xffffffff;
}

function pickVariant(variants: Array<{ id: string; weight: number }>, key: string) {
  const total = variants.reduce((sum, v) => sum + (v.weight ?? 0), 0) || 1;
  const normalized = variants.map((v) => ({ ...v, weight: (v.weight ?? 0) / total }));
  const r = hashToFloat(key);
  let acc = 0;
  for (const variant of normalized) {
    acc += variant.weight;
    if (r <= acc) return variant.id;
  }
  return normalized[normalized.length - 1]?.id;
}

function zTest(control: { conv: number; total: number }, variant: { conv: number; total: number }) {
  if (control.total === 0 || variant.total === 0) return null;
  const p1 = control.conv / control.total;
  const p2 = variant.conv / variant.total;
  const pooled = (control.conv + variant.conv) / (control.total + variant.total);
  const denom = Math.sqrt(pooled * (1 - pooled) * (1 / control.total + 1 / variant.total));
  if (denom === 0) return null;
  const z = (p2 - p1) / denom;
  return z;
}

@Injectable()
export class AbTestingService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled() {
    const company = await this.prisma.company.findFirst({ include: { settings: true } });
    return Boolean(company?.settings?.enableAbTesting);
  }

  async getCompanyId() {
    const company = await this.prisma.company.findFirst();
    if (!company) throw new NotFoundException("Company not found");
    return company.id;
  }

  listExperiments(companyId: string) {
    return this.prisma.experiment.findMany({ where: { companyId }, include: { variants: true }, orderBy: { createdAt: "desc" } });
  }

  async createExperiment(companyId: string, data: unknown) {
    return this.prisma.experiment.create({
      data: {
        companyId,
        name: data.name,
        target: data.target,
        status: data.status ?? ExperimentStatus.DRAFT,
        objectives: data.objectives ?? [],
        trafficSplit: data.trafficSplit ?? {},
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
  }

  async createVariant(companyId: string, experimentId: string, data: unknown) {
    const experiment = await this.prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment || experiment.companyId !== companyId) throw new NotFoundException("Experiment not found");
    return this.prisma.experimentVariant.create({
      data: {
        experimentId,
        name: data.name,
        weight: data.weight,
        payload: data.payload,
      },
    });
  }

  async getActiveExperiment(companyId: string, target: ExperimentTarget) {
    const now = new Date();
    return this.prisma.experiment.findFirst({
      where: {
        companyId,
        target,
        status: ExperimentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    });
  }

  parseCookie(raw?: string): AssignmentCookie {
    if (!raw) return { id: randomUUID(), assignments: {} };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.id) return { id: randomUUID(), assignments: {} };
      return { id: parsed.id, assignments: parsed.assignments ?? {} };
    } catch {
      return { id: randomUUID(), assignments: {} };
    }
  }

  async assign(companyId: string, target: ExperimentTarget, rawCookie?: string, userId?: string) {
    const experiment = await this.getActiveExperiment(companyId, target);
    if (!experiment) return { ok: false, reason: "no_active", cookie: rawCookie };
    if (experiment.variants.length === 0) return { ok: false, reason: "no_variants", cookie: rawCookie };

    const cookie = this.parseCookie(rawCookie);
    const existing = cookie.assignments[experiment.id];
    let variantId = existing;

    if (!variantId) {
      variantId = pickVariant(experiment.variants, `${experiment.id}:${userId ?? cookie.id}`);
      if (!variantId) throw new BadRequestException("Unable to assign variant");
      cookie.assignments[experiment.id] = variantId;
      await this.prisma.experimentAssignment.upsert({
        where: { experimentId_cookieId: { experimentId: experiment.id, cookieId: cookie.id } },
        create: {
          companyId,
          experimentId: experiment.id,
          variantId,
          userId: userId ?? null,
          cookieId: cookie.id,
        },
        update: {
          variantId,
          userId: userId ?? undefined,
        },
      });
    }

    const variant = experiment.variants.find((v) => v.id === variantId) ?? experiment.variants[0];
    return {
      ok: true,
      cookie,
      experiment: { id: experiment.id, name: experiment.name, target: experiment.target },
      variant: { id: variant.id, name: variant.name, payload: variant.payload },
    };
  }

  async recordEvent(companyId: string, assignment: { experimentId: string; variantId: string }, type: ExperimentEventType, orderId?: string) {
    await this.prisma.experimentEvent.create({
      data: {
        companyId,
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
        type,
        orderId: orderId ?? null,
      },
    });
  }

  async resolveAssignment(companyId: string, target: ExperimentTarget, rawCookie?: string) {
    const experiment = await this.getActiveExperiment(companyId, target);
    if (!experiment) return null;
    const cookie = this.parseCookie(rawCookie);
    const variantId = cookie.assignments[experiment.id];
    if (!variantId) return null;
    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) return null;
    return { experimentId: experiment.id, variantId: variant.id };
  }

  async report(companyId: string, experimentId: string) {
    const experiment = await this.prisma.experiment.findUnique({ where: { id: experimentId }, include: { variants: true } });
    if (!experiment || experiment.companyId !== companyId) throw new NotFoundException("Experiment not found");

    const events = await this.prisma.experimentEvent.groupBy({
      by: ["variantId", "type"],
      where: { experimentId },
      _count: { _all: true },
    });

    const totals = new Map<string, { addToCart: number; conversion: number }>();
    for (const row of events) {
      const entry = totals.get(row.variantId) ?? { addToCart: 0, conversion: 0 };
      if (row.type === ExperimentEventType.ADD_TO_CART) entry.addToCart = row._count._all;
      if (row.type === ExperimentEventType.CONVERSION) entry.conversion = row._count._all;
      totals.set(row.variantId, entry);
    }

    const control = experiment.variants[0];
    const results = experiment.variants.map((variant) => {
      const entry = totals.get(variant.id) ?? { addToCart: 0, conversion: 0 };
      return {
        variantId: variant.id,
        name: variant.name,
        addToCart: entry.addToCart,
        conversions: entry.conversion,
        conversionRate: entry.addToCart ? entry.conversion / entry.addToCart : 0,
      };
    });

    const controlStats = results.find((r) => r.variantId === control?.id) ?? results[0];
    const significance = results.map((variant) => {
      if (!controlStats || variant.variantId === controlStats.variantId) {
        return { variantId: variant.variantId, z: null, significant: false, reason: "control" };
      }
      if (controlStats.addToCart < 50 || variant.addToCart < 50) {
        return { variantId: variant.variantId, z: null, significant: false, reason: "insufficient_sample" };
      }
      const z = zTest(
        { conv: controlStats.conversions, total: controlStats.addToCart },
        { conv: variant.conversions, total: variant.addToCart },
      );
      const significant = z !== null && Math.abs(z) >= 1.96;
      return { variantId: variant.variantId, z, significant, reason: significant ? "significant" : "not_significant" };
    });

    return {
      experiment: { id: experiment.id, name: experiment.name, target: experiment.target, status: experiment.status },
      results,
      significance,
      guardrails: { minSample: 50 },
    };
  }
}
