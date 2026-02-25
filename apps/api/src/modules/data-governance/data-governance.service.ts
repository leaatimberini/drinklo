import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GovernanceEntity, LegalHoldStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateLegalHoldDto,
  ReleaseLegalHoldDto,
  UpsertRetentionPoliciesDto,
} from "./dto/governance.dto";
import {
  DEFAULT_RETENTION_MATRIX,
  GOVERNANCE_ENTITIES,
  normalizeGovernancePlan,
  type GovernancePlanTier,
} from "./retention-policy-resolver";
import { matchesHoldByCustomerId, matchesHoldByEmail, matchesHoldByUserId } from "./legal-hold-matcher";
import { sha256, stableStringify } from "../immutable-audit/immutable-audit.service";

type EntitySummary = {
  scanned: number;
  purged: number;
  anonymized: number;
  skippedByHold: number;
  unresolvedIdentity: number;
  errors: number;
};

type PurgeSummary = Record<GovernanceEntity, EntitySummary> & {
  policy: Record<string, number>;
};

@Injectable()
export class DataGovernanceService {
  private readonly logger = new Logger(DataGovernanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  private emptyEntitySummary(): EntitySummary {
    return {
      scanned: 0,
      purged: 0,
      anonymized: 0,
      skippedByHold: 0,
      unresolvedIdentity: 0,
      errors: 0,
    };
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private extractIdentity(payload: unknown): { customerId?: string; customerEmail?: string; userId?: string } {
    if (!payload || typeof payload !== "object") return {};
    const obj = payload as Record<string, any>;
    const customerId = obj.customerId ?? obj.customer?.id ?? undefined;
    const customerEmail = obj.customerEmail ?? obj.email ?? obj.customer?.email ?? obj.recipient ?? undefined;
    const userId = obj.userId ?? obj.user?.id ?? undefined;
    return {
      customerId: typeof customerId === "string" ? customerId : undefined,
      customerEmail: typeof customerEmail === "string" ? customerEmail.toLowerCase() : undefined,
      userId: typeof userId === "string" ? userId : undefined,
    };
  }

  private async resolveCurrentPlan(companyId: string): Promise<GovernancePlanTier> {
    const license = await this.prisma.licenseKey.findUnique({
      where: { companyId },
      select: { plan: true },
    });
    return normalizeGovernancePlan(license?.plan ?? "pro");
  }

  async ensureDefaultPolicies(companyId: string, actorUserId?: string) {
    const count = await this.prisma.dataRetentionPolicy.count({ where: { companyId } });
    if (count > 0) return;

    await this.prisma.dataRetentionPolicy.createMany({
      data: (Object.keys(DEFAULT_RETENTION_MATRIX) as GovernancePlanTier[]).flatMap((plan) =>
        GOVERNANCE_ENTITIES.map((entity) => ({
          companyId,
          plan,
          entity,
          retentionDays: DEFAULT_RETENTION_MATRIX[plan][entity],
          createdById: actorUserId ?? null,
          updatedById: actorUserId ?? null,
        })),
      ),
    });

    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: {
        retentionOrdersDays: true,
        retentionLogsDays: true,
        retentionMarketingDays: true,
      },
    });

    if (!settings) return;

    const proOverrides: Array<{ entity: GovernanceEntity; retentionDays: number }> = [
      { entity: GovernanceEntity.ORDERS, retentionDays: settings.retentionOrdersDays ?? DEFAULT_RETENTION_MATRIX.pro.ORDERS },
      { entity: GovernanceEntity.LOGS, retentionDays: settings.retentionLogsDays ?? DEFAULT_RETENTION_MATRIX.pro.LOGS },
      { entity: GovernanceEntity.EVENTS, retentionDays: settings.retentionLogsDays ?? DEFAULT_RETENTION_MATRIX.pro.EVENTS },
      { entity: GovernanceEntity.MARKETING, retentionDays: settings.retentionMarketingDays ?? DEFAULT_RETENTION_MATRIX.pro.MARKETING },
    ];

    for (const item of proOverrides) {
      await this.prisma.dataRetentionPolicy.update({
        where: { companyId_plan_entity: { companyId, plan: "pro", entity: item.entity } },
        data: {
          retentionDays: item.retentionDays,
          updatedById: actorUserId ?? null,
        },
      });
    }
  }

  async listPolicies(companyId: string) {
    await this.ensureDefaultPolicies(companyId);
    return this.prisma.dataRetentionPolicy.findMany({
      where: { companyId },
      orderBy: [{ plan: "asc" }, { entity: "asc" }],
    });
  }

  async upsertPolicies(companyId: string, payload: UpsertRetentionPoliciesDto, actorUserId?: string) {
    await this.ensureDefaultPolicies(companyId, actorUserId);
    const updated = [];
    for (const item of payload.items) {
      const row = await this.prisma.dataRetentionPolicy.upsert({
        where: { companyId_plan_entity: { companyId, plan: item.plan, entity: item.entity } },
        update: { retentionDays: item.retentionDays, updatedById: actorUserId ?? null },
        create: {
          companyId,
          plan: item.plan,
          entity: item.entity,
          retentionDays: item.retentionDays,
          createdById: actorUserId ?? null,
          updatedById: actorUserId ?? null,
        },
      });
      updated.push(row);
    }
    return updated;
  }

  async getEffectivePolicies(companyId: string) {
    await this.ensureDefaultPolicies(companyId);
    const plan = await this.resolveCurrentPlan(companyId);
    const rows = await this.prisma.dataRetentionPolicy.findMany({
      where: { companyId, plan },
      orderBy: { entity: "asc" },
    });

    return {
      planSource: "LicenseKey.plan",
      currentPlan: plan,
      entities: GOVERNANCE_ENTITIES.map((entity) => {
        const row = rows.find((item) => item.entity === entity);
        return {
          entity,
          retentionDays: row?.retentionDays ?? DEFAULT_RETENTION_MATRIX[plan][entity],
          source: row ? "override" : "default",
        };
      }),
    };
  }

  async createLegalHold(companyId: string, payload: CreateLegalHoldDto, userId: string) {
    if (!payload.customerId && !payload.userId) {
      throw new NotFoundException("customerId or userId is required");
    }

    let customer: { id: string; email: string | null; name?: string } | null = null;
    let subjectUser: { id: string; email: string; name: string } | null = null;
    if (payload.customerId) {
      customer = await this.prisma.customer.findFirst({
        where: { id: payload.customerId, companyId },
        select: { id: true, email: true, name: true },
      });
      if (!customer) {
        throw new NotFoundException("Customer not found");
      }
    }
    if (payload.userId) {
      subjectUser = await this.prisma.user.findFirst({
        where: { id: payload.userId, companyId, deletedAt: null },
        select: { id: true, email: true, name: true },
      });
      if (!subjectUser) {
        throw new NotFoundException("User not found");
      }
    }

    const entities =
      payload.entities && payload.entities.length > 0
        ? Array.from(new Set(payload.entities))
        : [...GOVERNANCE_ENTITIES];
    const evidence =
      payload.evidence && typeof payload.evidence === "object"
        ? {
            ...payload.evidence,
            createdBy: userId,
            createdAt: new Date().toISOString(),
          }
        : {
            note: "hold created without custom evidence payload",
            createdBy: userId,
            createdAt: new Date().toISOString(),
          };
    const evidenceHash = sha256(stableStringify(evidence));

    return this.prisma.legalHold.create({
      data: {
        companyId,
        customerId: payload.customerId ?? null,
        customerEmailSnapshot: customer?.email?.toLowerCase() ?? null,
        userId: payload.userId ?? null,
        userEmailSnapshot: subjectUser?.email?.toLowerCase() ?? null,
        entityScopes: entities,
        periodFrom: this.parseDate(payload.periodFrom),
        periodTo: this.parseDate(payload.periodTo),
        reason: payload.reason,
        evidence: evidence as any,
        evidenceHash,
        status: LegalHoldStatus.ACTIVE,
        createdById: userId,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listLegalHolds(companyId: string) {
    return this.prisma.legalHold.findMany({
      where: { companyId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true, roleId: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        releasedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async releaseLegalHold(companyId: string, holdId: string, payload: ReleaseLegalHoldDto, userId: string) {
    const hold = await this.prisma.legalHold.findFirst({ where: { id: holdId, companyId } });
    if (!hold) {
      throw new NotFoundException("Legal hold not found");
    }

    return this.prisma.legalHold.update({
      where: { id: holdId },
      data: {
        status: LegalHoldStatus.RELEASED,
        releasedById: userId,
        releasedAt: new Date(),
        reason: payload.reason ? `${hold.reason}\nRelease note: ${payload.reason}` : hold.reason,
      },
    });
  }

  private async activeHolds(companyId: string) {
    return this.prisma.legalHold.findMany({
      where: { companyId, status: LegalHoldStatus.ACTIVE },
      select: {
        id: true,
        customerId: true,
        customerEmailSnapshot: true,
        userId: true,
        userEmailSnapshot: true,
        entityScopes: true,
        periodFrom: true,
        periodTo: true,
      },
    });
  }

  private summarizePolicy(policy: Array<{ entity: GovernanceEntity; retentionDays: number }>) {
    const map: Record<string, number> = {};
    for (const item of policy) {
      map[item.entity] = item.retentionDays;
    }
    return map;
  }

  private async resolvePolicyRows(companyId: string) {
    const effective = await this.getEffectivePolicies(companyId);
    return effective.entities.map((entity) => ({ entity: entity.entity as GovernanceEntity, retentionDays: entity.retentionDays }));
  }

  private cutoff(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async purgeOrders(companyId: string, retentionDays: number, holds: Awaited<ReturnType<DataGovernanceService["activeHolds"]>>, runId: string, summary: EntitySummary) {
    const cutoff = this.cutoff(retentionDays);
    const items = await this.prisma.order.findMany({
      where: {
        companyId,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        customerEmail: true,
        createdAt: true,
        shippingMeta: true,
      },
      take: 1000,
      orderBy: { createdAt: "asc" },
    });

    for (const item of items) {
      summary.scanned += 1;
      const heldByEmail = item.customerEmail
        ? matchesHoldByEmail(holds, item.customerEmail, item.createdAt, GovernanceEntity.ORDERS)
        : false;
      if (heldByEmail) {
        summary.skippedByHold += 1;
        continue;
      }
      try {
        await this.prisma.order.update({
          where: { id: item.id },
          data: {
            customerName: "ANONYMIZED",
            customerEmail: `anon+${item.id}@example.invalid`,
            customerPhone: null,
            addressLine1: null,
            addressLine2: null,
            city: null,
            state: null,
            postalCode: null,
            country: null,
            shippingMeta: {
              ...((item.shippingMeta as Record<string, any> | null) ?? {}),
              governance: {
                runId,
                anonymizedAt: new Date().toISOString(),
              },
            },
          },
        });
        summary.anonymized += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }

  private async purgeEvents(companyId: string, retentionDays: number, holds: Awaited<ReturnType<DataGovernanceService["activeHolds"]>>, summary: EntitySummary) {
    const cutoff = this.cutoff(retentionDays);
    const events = await this.prisma.eventLog.findMany({
      where: { companyId, receivedAt: { lt: cutoff } },
      select: { id: true, payload: true, receivedAt: true },
      take: 2000,
      orderBy: { receivedAt: "asc" },
    });

    for (const event of events) {
      summary.scanned += 1;
      const identity = this.extractIdentity(event.payload);
      let held = false;
      if (identity.customerId) {
        held = matchesHoldByCustomerId(holds, identity.customerId, event.receivedAt, GovernanceEntity.EVENTS);
      } else if (identity.customerEmail) {
        held = matchesHoldByEmail(holds, identity.customerEmail, event.receivedAt, GovernanceEntity.EVENTS);
      } else if (identity.userId) {
        held = matchesHoldByUserId(holds, identity.userId, event.receivedAt, GovernanceEntity.EVENTS);
      } else {
        summary.unresolvedIdentity += 1;
      }
      if (held) {
        summary.skippedByHold += 1;
        continue;
      }
      try {
        await this.prisma.eventLog.delete({ where: { id: event.id } });
        summary.purged += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }

  private async purgeMarketing(companyId: string, retentionDays: number, holds: Awaited<ReturnType<DataGovernanceService["activeHolds"]>>, summary: EntitySummary) {
    const cutoff = this.cutoff(retentionDays);

    const sends = await this.prisma.automationSendLog.findMany({
      where: { companyId, sentAt: { lt: cutoff } },
      select: { id: true, recipient: true, sentAt: true },
      take: 2000,
      orderBy: { sentAt: "asc" },
    });
    for (const send of sends) {
      summary.scanned += 1;
      if (!send.recipient) {
        summary.unresolvedIdentity += 1;
      }
      const held = send.recipient
        ? matchesHoldByEmail(holds, send.recipient, send.sentAt, GovernanceEntity.MARKETING)
        : false;
      if (held) {
        summary.skippedByHold += 1;
        continue;
      }
      try {
        await this.prisma.automationSendLog.delete({ where: { id: send.id } });
        summary.purged += 1;
      } catch {
        summary.errors += 1;
      }
    }

    const emailLogs = await this.prisma.emailEventLog.findMany({
      where: { companyId, createdAt: { lt: cutoff } },
      select: { id: true, recipient: true, createdAt: true, payload: true },
      take: 2000,
      orderBy: { createdAt: "asc" },
    });

    for (const row of emailLogs) {
      summary.scanned += 1;
      const payloadIdentity = this.extractIdentity(row.payload);
      const email = row.recipient ?? payloadIdentity.customerEmail;
      if (!email) {
        summary.unresolvedIdentity += 1;
      }
      const held = email ? matchesHoldByEmail(holds, email, row.createdAt, GovernanceEntity.MARKETING) : false;
      if (held) {
        summary.skippedByHold += 1;
        continue;
      }
      try {
        await this.prisma.emailEventLog.delete({ where: { id: row.id } });
        summary.purged += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }

  private async purgeLogs(companyId: string, retentionDays: number, holds: Awaited<ReturnType<DataGovernanceService["activeHolds"]>>, summary: EntitySummary) {
    const cutoff = this.cutoff(retentionDays);

    const webhookLogs = await this.prisma.webhookLog.findMany({
      where: { companyId, receivedAt: { lt: cutoff } },
      select: { id: true, payload: true, receivedAt: true },
      take: 2000,
      orderBy: { receivedAt: "asc" },
    });

    for (const row of webhookLogs) {
      summary.scanned += 1;
      const identity = this.extractIdentity(row.payload);
      let held = false;
      if (identity.customerId) {
        held = matchesHoldByCustomerId(holds, identity.customerId, row.receivedAt, GovernanceEntity.LOGS);
      } else if (identity.customerEmail) {
        held = matchesHoldByEmail(holds, identity.customerEmail, row.receivedAt, GovernanceEntity.LOGS);
      } else if (identity.userId) {
        held = matchesHoldByUserId(holds, identity.userId, row.receivedAt, GovernanceEntity.LOGS);
      } else {
        summary.unresolvedIdentity += 1;
      }
      if (held) {
        summary.skippedByHold += 1;
        continue;
      }
      try {
        await this.prisma.webhookLog.delete({ where: { id: row.id } });
        summary.purged += 1;
      } catch {
        summary.errors += 1;
      }
    }

    const privacy = await this.prisma.privacyRequest.findMany({
      where: { companyId, createdAt: { lt: cutoff } },
      select: { id: true, customerId: true, createdAt: true },
      take: 2000,
      orderBy: { createdAt: "asc" },
    });
    for (const row of privacy) {
      summary.scanned += 1;
      const held = row.customerId
        ? matchesHoldByCustomerId(holds, row.customerId, row.createdAt, GovernanceEntity.LOGS)
        : false;
      if (held) {
        summary.skippedByHold += 1;
        continue;
      }
      if (!row.customerId) {
        summary.unresolvedIdentity += 1;
      }
      try {
        await this.prisma.privacyRequest.delete({ where: { id: row.id } });
        summary.purged += 1;
      } catch {
        summary.errors += 1;
      }
    }

    const botLogs = await this.prisma.botCommandLog.findMany({
      where: { companyId, createdAt: { lt: cutoff } },
      select: { id: true },
      take: 2000,
      orderBy: { createdAt: "asc" },
    });
    for (const row of botLogs) {
      summary.scanned += 1;
      summary.unresolvedIdentity += 1;
      try {
        await this.prisma.botCommandLog.delete({ where: { id: row.id } });
        summary.purged += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }

  async runPurge(companyId: string, actorUserId?: string, triggerType: "cron" | "manual" = "manual") {
    await this.ensureDefaultPolicies(companyId, actorUserId);
    const policyRows = await this.resolvePolicyRows(companyId);
    const policyMap = new Map(policyRows.map((row) => [row.entity, row.retentionDays]));
    const holds = await this.activeHolds(companyId);

    const run = await this.prisma.governanceRun.create({
      data: {
        companyId,
        triggeredBy: actorUserId ?? null,
        triggerType,
        startedAt: new Date(),
        status: "RUNNING",
      },
    });

    const summary: PurgeSummary = {
      [GovernanceEntity.ORDERS]: this.emptyEntitySummary(),
      [GovernanceEntity.LOGS]: this.emptyEntitySummary(),
      [GovernanceEntity.EVENTS]: this.emptyEntitySummary(),
      [GovernanceEntity.MARKETING]: this.emptyEntitySummary(),
      policy: this.summarizePolicy(policyRows),
    };

    try {
      await this.purgeOrders(companyId, policyMap.get(GovernanceEntity.ORDERS) ?? DEFAULT_RETENTION_MATRIX.pro.ORDERS, holds, run.id, summary[GovernanceEntity.ORDERS]);
      await this.purgeLogs(companyId, policyMap.get(GovernanceEntity.LOGS) ?? DEFAULT_RETENTION_MATRIX.pro.LOGS, holds, summary[GovernanceEntity.LOGS]);
      await this.purgeEvents(companyId, policyMap.get(GovernanceEntity.EVENTS) ?? DEFAULT_RETENTION_MATRIX.pro.EVENTS, holds, summary[GovernanceEntity.EVENTS]);
      await this.purgeMarketing(
        companyId,
        policyMap.get(GovernanceEntity.MARKETING) ?? DEFAULT_RETENTION_MATRIX.pro.MARKETING,
        holds,
        summary[GovernanceEntity.MARKETING],
      );

      const updated = await this.prisma.governanceRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "DONE",
          summary,
        },
      });

      return {
        runId: updated.id,
        startedAt: updated.startedAt,
        finishedAt: updated.finishedAt,
        status: updated.status,
        summary,
      };
    } catch (error: any) {
      await this.prisma.governanceRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "FAILED",
          summary,
          error: error?.message ?? String(error),
        },
      });
      throw error;
    }
  }

  async listRuns(companyId: string, limit = 20) {
    return this.prisma.governanceRun.findMany({
      where: { companyId },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  @Cron("15 3 * * *", { timeZone: "America/Argentina/Buenos_Aires" })
  async cronPurge() {
    if ((process.env.GOVERNANCE_CRON_ENABLED ?? "true").toLowerCase() === "false") {
      return;
    }
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await this.runPurge(company.id, undefined, "cron");
      } catch (error: any) {
        this.logger.warn(`Governance purge failed for ${company.id}: ${error?.message ?? String(error)}`);
      }
    }
  }
}
