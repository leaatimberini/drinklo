import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccessReviewCadence,
  AccessReviewCampaignStatus,
  AccessReviewDecision,
  Prisma,
  SodPolicyMode,
  SodViolationOutcome,
} from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { RolePermissions } from "../common/rbac.constants";
import type {
  CreateAccessReviewCampaignDto,
  ReviewAccessReviewItemDto,
  UpsertSodPoliciesDto,
} from "./dto/sod-access-reviews.dto";

type ActionKey =
  | "PRICING_CONFIGURE"
  | "PURCHASE_APPROVE"
  | "INVOICE_ISSUE"
  | "RECONCILIATION_RUN";

type EvaluateInput = {
  companyId: string;
  userId?: string;
  permissions: string[];
  requestAction: string;
  route?: string;
  method?: string;
};

const SOD_ACTION_REGISTRY: Record<string, { permissions: string[]; description: string }> = {
  PRICING_CONFIGURE: {
    permissions: ["pricing:write"],
    description: "Configura precios/reglas impositivas",
  },
  PURCHASE_APPROVE: {
    permissions: ["inventory:write"],
    description: "Aprueba ordenes de compra",
  },
  INVOICE_ISSUE: {
    permissions: ["settings:write"],
    description: "Emite comprobantes (ARCA ex AFIP)",
  },
  RECONCILIATION_RUN: {
    permissions: ["inventory:read"],
    description: "Ejecuta conciliacion y exportes",
  },
};

const DEFAULT_SOD_POLICIES = [
  {
    code: "pricing_vs_purchase_approve",
    name: "Precios vs Aprobacion de compras",
    description: "Quien configura precios no debe aprobar compras.",
    actionA: "PRICING_CONFIGURE",
    actionB: "PURCHASE_APPROVE",
    mode: SodPolicyMode.DENY,
    enabled: true,
  },
  {
    code: "invoice_vs_reconciliation",
    name: "Facturacion vs Conciliacion",
    description: "Quien factura no debe conciliar.",
    actionA: "INVOICE_ISSUE",
    actionB: "RECONCILIATION_RUN",
    mode: SodPolicyMode.DENY,
    enabled: true,
  },
] as const;

@Injectable()
export class SodAccessReviewsService {
  private readonly logger = new Logger(SodAccessReviewsService.name);
  private readonly controlPlaneUrl: string;
  private readonly controlPlaneToken: string;
  private readonly instanceId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.controlPlaneUrl = this.config.get<string>("CONTROL_PLANE_URL") ?? "";
    this.controlPlaneToken = this.config.get<string>("CONTROL_PLANE_INGEST_TOKEN") ?? "";
    this.instanceId = this.config.get<string>("INSTANCE_ID") ?? "local-dev";
  }

  async listPolicies(companyId: string) {
    await this.ensureDefaultPolicies(companyId);
    return this.prisma.sodPolicy.findMany({
      where: { companyId },
      orderBy: [{ enabled: "desc" }, { code: "asc" }],
    });
  }

  async upsertPolicies(companyId: string, dto: UpsertSodPoliciesDto, actorId?: string) {
    if (!dto.items?.length) {
      throw new BadRequestException("items required");
    }

    const normalized = dto.items.map((item) => {
      const [actionA, actionB] = [String(item.actionA), String(item.actionB)].sort() as [string, string];
      if (actionA === actionB) {
        throw new BadRequestException(`Policy ${item.code}: actionA and actionB must differ`);
      }
      return {
        ...item,
        actionA,
        actionB,
        pairKey: `${actionA}::${actionB}`,
      };
    });

    const saved = await this.prisma.$transaction(async (tx) => {
      const out = [] as any[];
      for (const item of normalized) {
        const row = await tx.sodPolicy.upsert({
          where: { companyId_code: { companyId, code: item.code } },
          update: {
            name: item.name,
            description: item.description ?? null,
            actionA: item.actionA,
            actionB: item.actionB,
            pairKey: item.pairKey,
            mode: item.mode as any,
            enabled: item.enabled ?? true,
            updatedById: actorId ?? null,
          },
          create: {
            companyId,
            code: item.code,
            name: item.name,
            description: item.description ?? null,
            actionA: item.actionA,
            actionB: item.actionB,
            pairKey: item.pairKey,
            mode: item.mode as any,
            enabled: item.enabled ?? true,
            createdById: actorId ?? null,
            updatedById: actorId ?? null,
          },
        });
        out.push(row);
      }
      return out;
    });

    void this.reportToControlPlane(companyId);
    return saved;
  }

  async evaluateAndRecord(input: EvaluateInput): Promise<{ allowed: boolean; violations: any[] }> {
    if (!input.companyId || !input.requestAction) {
      return { allowed: true, violations: [] };
    }

    await this.ensureDefaultPolicies(input.companyId);
    const policies = await this.prisma.sodPolicy.findMany({
      where: {
        companyId: input.companyId,
        enabled: true,
        OR: [{ actionA: input.requestAction }, { actionB: input.requestAction }],
      },
      orderBy: { code: "asc" },
    });
    if (policies.length === 0) {
      return { allowed: true, violations: [] };
    }

    const permissionsSet = new Set((input.permissions ?? []).map(String));
    const violations: any[] = [];
    let allowed = true;

    for (const policy of policies) {
      const conflictingAction =
        policy.actionA === input.requestAction ? policy.actionB : policy.actionA;
      const registry = SOD_ACTION_REGISTRY[conflictingAction];
      const hasConflictAction =
        registry?.permissions?.length
          ? registry.permissions.every((perm) => permissionsSet.has(perm))
          : false;
      if (!hasConflictAction) continue;

      const outcome =
        policy.mode === SodPolicyMode.DENY
          ? SodViolationOutcome.DENIED
          : SodViolationOutcome.ALLOWED_ALERTED;
      const violation = await this.prisma.sodViolationEvent.create({
        data: {
          companyId: input.companyId,
          userId: input.userId ?? null,
          policyId: policy.id,
          requestAction: input.requestAction,
          conflictingAction,
          route: input.route ?? null,
          method: input.method ?? null,
          outcome,
          metadata: {
            requestActionDescription: SOD_ACTION_REGISTRY[input.requestAction]?.description ?? null,
            conflictingActionDescription: registry?.description ?? null,
            permissions: Array.from(permissionsSet).sort(),
          } as Prisma.InputJsonValue,
        },
      });
      violations.push(violation);
      if (policy.mode === SodPolicyMode.DENY) {
        allowed = false;
      }
    }

    if (violations.length > 0) {
      void this.reportToControlPlane(input.companyId);
    }

    return { allowed, violations };
  }

  async listViolations(companyId: string, limit = 50) {
    return this.prisma.sodViolationEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        user: { select: { id: true, email: true, name: true } },
        policy: { select: { id: true, code: true, name: true, mode: true } },
      },
    });
  }

  async createAccessReviewCampaign(companyId: string, dto: CreateAccessReviewCampaignDto, actorId?: string) {
    const now = new Date();
    const cadence = dto.cadence as AccessReviewCadence;
    const periodStart = cadence === AccessReviewCadence.MONTHLY
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      : new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    const periodEnd = cadence === AccessReviewCadence.MONTHLY
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
      : new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999));
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException("Invalid dueAt");
    }

    const users = await this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
      orderBy: { email: "asc" },
    });

    const campaignName =
      dto.name?.trim() ||
      `Access Review ${cadence === AccessReviewCadence.MONTHLY ? "Monthly" : "Quarterly"} ${periodStart.toISOString().slice(0, 10)}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.accessReviewCampaign.create({
        data: {
          companyId,
          name: campaignName,
          cadence,
          status: AccessReviewCampaignStatus.OPEN,
          periodStart,
          periodEnd,
          dueAt,
          notes: dto.notes ?? null,
          createdById: actorId ?? null,
          summary: { generatedUserCount: users.length } as Prisma.InputJsonValue,
        },
      });

      if (users.length > 0) {
        await tx.accessReviewItem.createMany({
          data: users.map((user) => ({
            companyId,
            campaignId: campaign.id,
            userId: user.id,
            roleId: user.roleId ?? null,
            roleName: user.role?.name ?? null,
            permissionCodes: this.resolveUserPermissionCodes(user) as Prisma.InputJsonValue,
            decision: AccessReviewDecision.PENDING,
          })),
        });
      }

      return campaign;
    });

    void this.reportToControlPlane(companyId);
    return this.getCampaign(companyId, created.id);
  }

  async listAccessReviewCampaigns(companyId: string) {
    return this.prisma.accessReviewCampaign.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async getCampaign(companyId: string, id: string) {
    const campaign = await this.prisma.accessReviewCampaign.findFirst({
      where: { id, companyId },
      include: { _count: { select: { items: true } } },
    });
    if (!campaign) throw new BadRequestException("Campaign not found");
    return campaign;
  }

  async listAccessReviewItems(companyId: string, campaignId: string) {
    return this.prisma.accessReviewItem.findMany({
      where: { companyId, campaignId },
      orderBy: [{ decision: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, email: true, name: true } },
        reviewer: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async reviewAccessReviewItem(companyId: string, itemId: string, dto: ReviewAccessReviewItemDto, actorId?: string) {
    const item = await this.prisma.accessReviewItem.findFirst({
      where: { id: itemId, companyId },
      include: { campaign: true },
    });
    if (!item) throw new BadRequestException("Item not found");
    if (item.campaign.status === AccessReviewCampaignStatus.COMPLETED || item.campaign.status === AccessReviewCampaignStatus.CANCELED) {
      throw new BadRequestException("Campaign closed");
    }

    const updated = await this.prisma.accessReviewItem.update({
      where: { id: itemId },
      data: {
        decision: dto.decision as AccessReviewDecision,
        reviewNotes: dto.reviewNotes ?? null,
        reviewerId: actorId ?? null,
        reviewedAt: new Date(),
      },
    });

    await this.refreshCampaignSummary(item.campaignId);
    void this.reportToControlPlane(companyId);
    return updated;
  }

  async approveCampaign(companyId: string, campaignId: string, actorId?: string) {
    const campaign = await this.prisma.accessReviewCampaign.findFirst({ where: { id: campaignId, companyId } });
    if (!campaign) throw new BadRequestException("Campaign not found");
    const pending = await this.prisma.accessReviewItem.count({
      where: { companyId, campaignId, decision: AccessReviewDecision.PENDING },
    });
    if (pending > 0) {
      throw new BadRequestException("Pending review items remain");
    }

    const updated = await this.prisma.accessReviewCampaign.update({
      where: { id: campaignId },
      data: {
        status: AccessReviewCampaignStatus.APPROVED,
        approvedById: actorId ?? null,
        approvedAt: new Date(),
      },
    });
    await this.refreshCampaignSummary(campaignId);
    void this.reportToControlPlane(companyId);
    return updated;
  }

  async completeCampaign(companyId: string, campaignId: string, actorId?: string) {
    const campaign = await this.prisma.accessReviewCampaign.findFirst({ where: { id: campaignId, companyId } });
    if (!campaign) throw new BadRequestException("Campaign not found");
    const updated = await this.prisma.accessReviewCampaign.update({
      where: { id: campaignId },
      data: {
        status: AccessReviewCampaignStatus.COMPLETED,
        completedAt: new Date(),
        approvedById: campaign.approvedById ?? actorId ?? null,
      },
    });
    await this.refreshCampaignSummary(campaignId);
    void this.reportToControlPlane(companyId);
    return updated;
  }

  async getSummary(companyId: string) {
    await this.ensureDefaultPolicies(companyId);
    const now = new Date();
    const [policyRows, violations24h, openCampaigns, overdueCampaigns, campaigns] = await Promise.all([
      this.prisma.sodPolicy.findMany({ where: { companyId }, orderBy: { code: "asc" } }),
      this.prisma.sodViolationEvent.count({
        where: { companyId, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.accessReviewCampaign.count({
        where: { companyId, status: { in: [AccessReviewCampaignStatus.OPEN, AccessReviewCampaignStatus.APPROVED] } },
      }),
      this.prisma.accessReviewCampaign.count({
        where: {
          companyId,
          status: { in: [AccessReviewCampaignStatus.OPEN, AccessReviewCampaignStatus.APPROVED] },
          dueAt: { lt: now },
        },
      }),
      this.prisma.accessReviewCampaign.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { items: true } } },
      }),
    ]);

    return {
      registry: SOD_ACTION_REGISTRY,
      policies: policyRows,
      metrics: {
        activePolicies: policyRows.filter((p) => p.enabled).length,
        totalPolicies: policyRows.length,
        violations24h,
        openCampaigns,
        overdueCampaigns,
      },
      recentCampaigns: campaigns,
    };
  }

  async reportToControlPlane(companyId: string) {
    if (!this.controlPlaneUrl || !this.controlPlaneToken) return;
    try {
      const summary = await this.buildControlPlanePayload(companyId);
      const url = `${this.controlPlaneUrl.replace(/\/$/, "")}/api/sod/report`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cp-ingest-token": this.controlPlaneToken,
        },
        body: JSON.stringify(summary),
      });
    } catch (error: any) {
      this.logger.warn(`control-plane SoD report failed: ${error?.message ?? "unknown"}`);
    }
  }

  async ensureDefaultPolicies(companyId: string) {
    const count = await this.prisma.sodPolicy.count({ where: { companyId } });
    if (count > 0) return;
    await this.prisma.sodPolicy.createMany({
      data: DEFAULT_SOD_POLICIES.map((p) => {
        const [a, b] = [p.actionA, p.actionB].sort();
        return {
          companyId,
          code: p.code,
          name: p.name,
          description: p.description,
          actionA: a,
          actionB: b,
          pairKey: `${a}::${b}`,
          mode: p.mode,
          enabled: p.enabled,
        };
      }),
      skipDuplicates: true,
    });
  }

  private async refreshCampaignSummary(campaignId: string) {
    const counts = await this.prisma.accessReviewItem.groupBy({
      by: ["decision"],
      where: { campaignId },
      _count: { _all: true },
    });
    const summary = counts.reduce<Record<string, number>>((acc, row) => {
      acc[row.decision] = row._count._all;
      return acc;
    }, {});
    await this.prisma.accessReviewCampaign.update({
      where: { id: campaignId },
      data: { summary: summary as Prisma.InputJsonValue },
    });
  }

  private resolveUserPermissionCodes(user: {
    role?: { name: string; rolePermissions?: Array<{ permission: { code: string } }> } | null;
  }) {
    const dbCodes = (user.role?.rolePermissions ?? [])
      .map((rp) => rp.permission?.code)
      .filter((code): code is string => Boolean(code));
    if (dbCodes.length > 0) return Array.from(new Set(dbCodes)).sort();
    const fallback = RolePermissions[(String(user.role?.name ?? "").toLowerCase() as keyof typeof RolePermissions)] ?? [];
    return Array.from(new Set(fallback)).sort();
  }

  private async buildControlPlanePayload(companyId: string) {
    const now = new Date();
    const [metrics, recentViolations, recentCampaigns] = await Promise.all([
      this.getSummary(companyId),
      this.prisma.sodViolationEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { id: true, email: true, name: true } }, policy: true },
      }),
      this.prisma.accessReviewCampaign.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { _count: { select: { items: true } } },
      }),
    ]);

    return {
      instanceId: this.instanceId,
      companyId,
      capturedAt: now.toISOString(),
      metrics: metrics.metrics,
      policies: metrics.policies.map((p: any) => ({
        code: p.code,
        name: p.name,
        actionA: p.actionA,
        actionB: p.actionB,
        mode: p.mode,
        enabled: p.enabled,
      })),
      recentViolations: recentViolations.map((v) => ({
        id: v.id,
        createdAt: v.createdAt.toISOString(),
        outcome: v.outcome,
        requestAction: v.requestAction,
        conflictingAction: v.conflictingAction,
        route: v.route,
        method: v.method,
        user: v.user ? { id: v.user.id, email: v.user.email, name: v.user.name } : null,
        policy: v.policy ? { id: v.policy.id, code: v.policy.code, name: v.policy.name, mode: v.policy.mode } : null,
      })),
      recentCampaigns: recentCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        cadence: c.cadence,
        status: c.status,
        dueAt: c.dueAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        itemsCount: c._count.items,
        summary: c.summary ?? null,
      })),
    };
  }
}
