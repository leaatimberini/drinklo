import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { PlansService } from "../plans/plans.service";
import { addDaysPreservingBuenosAiresWallClock } from "../plans/plan-time.util";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";

type Tier = "C1" | "C2" | "C3";

const TIER_ORDER: Tier[] = ["C1", "C2", "C3"];
const DAY_MS = 24 * 60 * 60 * 1000;

function tierRank(tier: Tier) {
  return TIER_ORDER.indexOf(tier);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function calculateProration(params: {
  fromPlanAmount: number;
  toPlanAmount: number;
  periodStart: Date;
  periodEnd: Date;
  effectiveAt: Date;
}) {
  const totalMs = Math.max(1, params.periodEnd.getTime() - params.periodStart.getTime());
  const usedMs = Math.min(totalMs, Math.max(0, params.effectiveAt.getTime() - params.periodStart.getTime()));
  const remainingRatio = (totalMs - usedMs) / totalMs;
  const credit = round2(Math.max(0, params.fromPlanAmount) * remainingRatio);
  const charge = round2(Math.max(0, params.toPlanAmount) * remainingRatio);
  const total = round2(charge - credit);
  return {
    remainingRatio: Number(remainingRatio.toFixed(6)),
    credit,
    charge,
    total,
  };
}

@Injectable()
export class BillingPlanChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly audit: ImmutableAuditService,
  ) {}

  @Cron("20 * * * *")
  async applyScheduledChangesCron() {
    if ((process.env.SUBSCRIPTION_LIFECYCLE_CRON_ENABLED ?? "true").toLowerCase() === "false") return;
    try {
      await this.applyDueScheduledChanges(new Date(), "cron");
    } catch {
      // best-effort
    }
  }

  private async getCatalogByTier() {
    const catalog = await this.plans.getPlanCatalog();
    return new Map(catalog.map((item: any) => [item.tier as Tier, item]));
  }

  private periodDurationDays(start: Date, end: Date) {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  }

  private async evaluateSoftLimits(companyId: string, targetTier: Tier, catalogByTier: Map<Tier, any>) {
    const entitlement = catalogByTier.get(targetTier);
    const usage = await this.plans.getCurrentUsage(companyId);
    if (!entitlement) {
      return { softLimited: false, reason: null, snapshot: null };
    }
    const checks = [
      ["ordersMonth", usage.ordersCount, entitlement.ordersMonth],
      ["apiCallsMonth", usage.apiCallsCount, entitlement.apiCallsMonth],
      ["storageGb", Number(usage.storageGbUsed), entitlement.storageGb],
      ["pluginsMax", usage.pluginsCount, entitlement.pluginsMax],
      ["branchesMax", usage.branchesCount, entitlement.branchesMax],
      ["adminUsersMax", usage.adminUsersCount, entitlement.adminUsersMax],
    ] as const;
    const exceeded = checks
      .filter(([, used, limit]) => Number(used) > Number(limit))
      .map(([metric, used, limit]) => ({ metric, used: Number(used), limit: Number(limit) }));
    if (exceeded.length === 0) {
      return { softLimited: false, reason: null, snapshot: null };
    }
    return {
      softLimited: true,
      reason: "DOWNGRADE_QUOTA_EXCEEDED_SOFT_LIMIT",
      snapshot: {
        policy: "soft_limit_no_data_deletion",
        targetTier,
        exceeded,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  async estimatePlanChange(companyId: string, targetTier: Tier, now = new Date()) {
    const [subscription, catalog] = await Promise.all([
      this.plans.getSubscription(companyId),
      this.getCatalogByTier(),
    ]);
    const currentTier = subscription.currentTier as Tier;
    if (currentTier === targetTier) {
      return {
        direction: "NONE",
        immediate: false,
        message: "Tier actual igual al target",
        currentTier,
        targetTier,
      };
    }
    const isUpgrade = tierRank(targetTier) > tierRank(currentTier);
    const currentPlan = catalog.get(currentTier);
    const targetPlan = catalog.get(targetTier);
    if (!currentPlan || !targetPlan) {
      throw new BadRequestException("Plan catalog incomplete");
    }

    if (isUpgrade) {
      const proration = calculateProration({
        fromPlanAmount: Number(currentPlan.monthlyPriceArs),
        toPlanAmount: Number(targetPlan.monthlyPriceArs),
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        effectiveAt: now,
      });
      return {
        direction: "UPGRADE",
        immediate: true,
        currentTier,
        targetTier,
        proration,
        lineItems: [
          {
            type: "CREDIT_UNUSED_TIME",
            description: `Credito por tiempo no usado de ${currentTier}`,
            amount: -proration.credit,
          },
          {
            type: "CHARGE_NEW_PLAN",
            description: `Cargo prorrateado de ${targetTier}`,
            amount: proration.charge,
          },
        ],
      };
    }

    return {
      direction: "DOWNGRADE",
      immediate: false,
      effectiveAt: subscription.currentPeriodEnd,
      currentTier,
      targetTier,
      lineItems: [],
      message: "Downgrade programado para proximo ciclo",
    };
  }

  async upgrade(companyId: string, targetTier: Tier, actorUserId?: string, dryRun = false, now = new Date()) {
    const estimate = await this.estimatePlanChange(companyId, targetTier, now);
    if (estimate.direction !== "UPGRADE") {
      throw new BadRequestException("Use /billing/downgrade for lower tiers");
    }
    if (dryRun) return { preview: true, ...estimate };

    const subscription = await this.plans.getSubscription(companyId);
    const txResult = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { companyId },
        data: {
          currentTier: targetTier,
          nextTier: null,
          softLimited: false,
          softLimitReason: null,
          softLimitSnapshot: Prisma.JsonNull,
        },
      });

      const prorationInvoice = await tx.prorationInvoice.create({
        data: {
          companyId,
          subscriptionId: updated.id,
          direction: "UPGRADE",
          status: "FINALIZED",
          fromTier: subscription.currentTier as Tier,
          toTier: targetTier,
          currency: "ARS",
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          effectiveAt: now,
          remainingRatio: new Prisma.Decimal((estimate as any).proration.remainingRatio),
          subtotal: new Prisma.Decimal((estimate as any).proration.total),
          total: new Prisma.Decimal((estimate as any).proration.total),
          details: estimate,
          createdById: actorUserId ?? null,
          items: {
            create: ((estimate as any).lineItems as Array<any>).map((item) => ({
              type: item.type,
              description: item.description,
              amount: new Prisma.Decimal(item.amount),
              metadata: Prisma.JsonNull,
            })),
          },
        },
        include: { items: true },
      });
      return { updated, prorationInvoice };
    });

    await this.audit.append({
      companyId,
      category: "billing",
      action: "subscription.plan.upgrade",
      method: "POST",
      route: "/billing/upgrade",
      statusCode: 200,
      actorUserId: actorUserId ?? null,
      actorRole: "admin",
      aggregateType: "subscription",
      aggregateId: txResult.updated.id,
      payload: {
        fromTier: subscription.currentTier,
        toTier: targetTier,
        prorationInvoiceId: txResult.prorationInvoice.id,
        dryRun: false,
      },
    });

    return {
      ...estimate,
      subscription: txResult.updated,
      prorationInvoice: txResult.prorationInvoice,
    };
  }

  async downgrade(companyId: string, targetTier: Tier, actorUserId?: string, dryRun = false, now = new Date()) {
    const estimate = await this.estimatePlanChange(companyId, targetTier, now);
    if (estimate.direction !== "DOWNGRADE") {
      throw new BadRequestException("Use /billing/upgrade for higher tiers");
    }
    if (dryRun) return { preview: true, ...estimate };
    const subscription = await this.prisma.subscription.update({
      where: { companyId },
      data: {
        nextTier: targetTier,
        cancelAtPeriodEnd: false,
      },
    });
    await this.audit.append({
      companyId,
      category: "billing",
      action: "subscription.plan.downgrade_scheduled",
      method: "POST",
      route: "/billing/downgrade",
      statusCode: 200,
      actorUserId: actorUserId ?? null,
      actorRole: "admin",
      aggregateType: "subscription",
      aggregateId: subscription.id,
      payload: {
        fromTier: subscription.currentTier,
        toTier: targetTier,
        effectiveAt: subscription.currentPeriodEnd,
      },
    });
    return {
      ...estimate,
      scheduled: true,
      subscription,
    };
  }

  async cancel(companyId: string, actorUserId?: string, dryRun = false) {
    const subscription = await this.plans.getSubscription(companyId);
    if (dryRun) {
      return {
        preview: true,
        action: "cancel",
        effectiveAt: subscription.currentPeriodEnd,
        currentStatus: subscription.status,
      };
    }
    const updated = await this.prisma.subscription.update({
      where: { companyId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: subscription.currentPeriodEnd,
      },
    });
    await this.audit.append({
      companyId,
      category: "billing",
      action: "subscription.cancel_scheduled",
      method: "POST",
      route: "/billing/cancel",
      statusCode: 200,
      actorUserId: actorUserId ?? null,
      actorRole: "admin",
      aggregateType: "subscription",
      aggregateId: updated.id,
      payload: {
        effectiveAt: updated.cancelledAt?.toISOString() ?? null,
      },
    });
    return { ok: true, effectiveAt: updated.cancelledAt, subscription: updated };
  }

  async reactivate(companyId: string, actorUserId?: string) {
    const updated = await this.prisma.subscription.update({
      where: { companyId },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });
    await this.audit.append({
      companyId,
      category: "billing",
      action: "subscription.reactivated",
      method: "POST",
      route: "/billing/reactivate",
      statusCode: 200,
      actorUserId: actorUserId ?? null,
      actorRole: "admin",
      aggregateType: "subscription",
      aggregateId: updated.id,
      payload: { status: updated.status },
    });
    return { ok: true, subscription: updated };
  }

  async applyDueScheduledChanges(now = new Date(), actor = "system") {
    const catalogByTier = await this.getCatalogByTier();
    const due = await this.prisma.subscription.findMany({
      where: {
        currentPeriodEnd: { lte: now },
        OR: [{ nextTier: { not: null } }, { cancelAtPeriodEnd: true }],
      },
    });
    const results: any[] = [];
    for (const row of due) {
      const durationDays = this.periodDurationDays(row.currentPeriodStart, row.currentPeriodEnd);
      if (row.cancelAtPeriodEnd) {
        const changed = await this.prisma.subscription.updateMany({
          where: { id: row.id, cancelAtPeriodEnd: true, status: { not: "CANCELLED" } },
          data: {
            status: "CANCELLED",
            cancelAtPeriodEnd: false,
            cancelledAt: now,
          },
        });
        if (changed.count > 0) {
          await this.audit.append({
            companyId: row.companyId,
            category: "billing",
            action: "subscription.cancel_applied",
            method: "JOB",
            route: "/billing/plan-change/apply-due",
            statusCode: 200,
            actorUserId: null,
            actorRole: actor,
            aggregateType: "subscription",
            aggregateId: row.id,
            payload: { at: now.toISOString() },
          });
          results.push({ id: row.id, action: "cancelled" });
        }
        continue;
      }

      const targetTier = row.nextTier as Tier | null;
      if (!targetTier || targetTier === row.currentTier) continue;
      const soft = await this.evaluateSoftLimits(row.companyId, targetTier, catalogByTier);
      const nextStart = row.currentPeriodEnd;
      const nextEnd = addDaysPreservingBuenosAiresWallClock(row.currentPeriodEnd, durationDays);
      const changed = await this.prisma.subscription.updateMany({
        where: { id: row.id, nextTier: targetTier, currentPeriodEnd: { lte: now } },
        data: {
          currentTier: targetTier,
          nextTier: null,
          currentPeriodStart: nextStart,
          currentPeriodEnd: nextEnd,
          softLimited: soft.softLimited,
          softLimitReason: soft.reason,
          softLimitSnapshot: soft.snapshot as any,
        },
      });
      if (changed.count === 0) continue;
      await this.audit.append({
        companyId: row.companyId,
        category: "billing",
        action: "subscription.plan.downgrade_applied",
        method: "JOB",
        route: "/billing/plan-change/apply-due",
        statusCode: 200,
        actorUserId: null,
        actorRole: actor,
        aggregateType: "subscription",
        aggregateId: row.id,
        payload: {
          fromTier: row.currentTier,
          toTier: targetTier,
          softLimited: soft.softLimited,
          softLimitReason: soft.reason,
          noDataDeletion: true,
        },
      });
      results.push({ id: row.id, action: "downgrade_applied", targetTier, softLimited: soft.softLimited });
    }
    return { scanned: due.length, applied: results.length, results };
  }
}
