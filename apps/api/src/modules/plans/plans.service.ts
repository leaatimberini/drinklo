import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PLAN_CATALOG_DEFAULTS, type PlanTierCode } from "./plan-catalog.constants";
import { buildTrialPeriod, getCurrentUsagePeriodBuenosAires } from "./plan-time.util";
import { computeLifecycleBanners, SUBSCRIPTION_RESTRICTED_CAPABILITIES } from "./subscription-lifecycle.policy";

type PrismaLike = Pick<
  PrismaService,
  "planEntitlement" | "subscription" | "usageCounter" | "order" | "branch" | "companyPlugin" | "user"
>;

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCatalog(client: PrismaLike = this.prisma) {
    for (const item of PLAN_CATALOG_DEFAULTS) {
      await client.planEntitlement.upsert({
        where: { tier: item.tier },
        update: {
          monthlyPriceArs: item.monthlyPriceArs,
          ordersMonth: item.ordersMonth,
          apiCallsMonth: item.apiCallsMonth,
          storageGb: item.storageGb,
          pluginsMax: item.pluginsMax,
          branchesMax: item.branchesMax,
          adminUsersMax: item.adminUsersMax,
          sloTarget: item.sloTarget,
          drFrequency: item.drFrequency,
          supportLevel: item.supportLevel,
        },
        create: {
          tier: item.tier,
          monthlyPriceArs: item.monthlyPriceArs,
          ordersMonth: item.ordersMonth,
          apiCallsMonth: item.apiCallsMonth,
          storageGb: item.storageGb,
          pluginsMax: item.pluginsMax,
          branchesMax: item.branchesMax,
          adminUsersMax: item.adminUsersMax,
          sloTarget: item.sloTarget,
          drFrequency: item.drFrequency,
          supportLevel: item.supportLevel,
        },
      });
    }
    return client.planEntitlement.findMany({ orderBy: { tier: "asc" } });
  }

  async ensureCompanySubscription(companyId: string, client: PrismaLike = this.prisma) {
    const existing = await client.subscription.findUnique({ where: { companyId } });
    if (existing) return existing;
    await this.ensureCatalog(client);
    const trial = buildTrialPeriod(new Date(), 30);
    return client.subscription.create({
      data: {
        companyId,
        status: "TRIAL_ACTIVE",
        currentTier: "C1",
        currentPeriodStart: trial.currentPeriodStart,
        currentPeriodEnd: trial.currentPeriodEnd,
        trialEndAt: trial.trialEndAt,
      },
    });
  }

  async getPlanCatalog() {
    return this.ensureCatalog();
  }

  async getSubscription(companyId: string) {
    return this.ensureCompanySubscription(companyId);
  }

  async getCurrentUsage(companyId: string) {
    const period = getCurrentUsagePeriodBuenosAires();
    const [ordersCount, branchesCount, pluginsCount, adminUsersCount, existing] = await Promise.all([
      this.prisma.order.count({
        where: {
          companyId,
          createdAt: { gte: period.periodStart, lt: period.periodEnd },
        },
      }),
      this.prisma.branch.count({ where: { companyId } }),
      this.prisma.companyPlugin.count({ where: { companyId, enabled: true } }),
      this.prisma.user.count({
        where: {
          companyId,
          deletedAt: null,
          role: { name: { equals: "Admin", mode: "insensitive" } },
        },
      }),
      this.prisma.usageCounter.findUnique({
        where: { companyId_periodKey: { companyId, periodKey: period.periodKey } },
      }),
    ]);

    return this.prisma.usageCounter.upsert({
      where: { companyId_periodKey: { companyId, periodKey: period.periodKey } },
      update: {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        ordersCount,
        branchesCount,
        pluginsCount,
        adminUsersCount,
        apiCallsCount: existing?.apiCallsCount ?? 0,
        storageGbUsed: existing?.storageGbUsed ?? 0,
      },
      create: {
        companyId,
        periodKey: period.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        ordersCount,
        apiCallsCount: existing?.apiCallsCount ?? 0,
        storageGbUsed: existing?.storageGbUsed ?? 0,
        pluginsCount,
        branchesCount,
        adminUsersCount,
      },
    });
  }

  async getEffective(companyId: string) {
    const [catalog, subscription, usage] = await Promise.all([
      this.getPlanCatalog(),
      this.getSubscription(companyId),
      this.getCurrentUsage(companyId),
    ]);
    const entitlement = catalog.find((item) => item.tier === subscription.currentTier);
    if (!entitlement) {
      throw new NotFoundException(`Plan entitlement not found for ${subscription.currentTier}`);
    }
    return {
      subscription,
      entitlements: entitlement,
      usage,
      usagePercentages: {
        ordersMonth: entitlement.ordersMonth > 0 ? Math.round((usage.ordersCount / entitlement.ordersMonth) * 100) : 0,
        apiCallsMonth:
          entitlement.apiCallsMonth > 0 ? Math.round((usage.apiCallsCount / entitlement.apiCallsMonth) * 100) : 0,
        storageGb: entitlement.storageGb > 0 ? Math.round((Number(usage.storageGbUsed) / entitlement.storageGb) * 100) : 0,
        pluginsMax: entitlement.pluginsMax > 0 ? Math.round((usage.pluginsCount / entitlement.pluginsMax) * 100) : 0,
        branchesMax: entitlement.branchesMax > 0 ? Math.round((usage.branchesCount / entitlement.branchesMax) * 100) : 0,
        adminUsersMax:
          entitlement.adminUsersMax > 0 ? Math.round((usage.adminUsersCount / entitlement.adminUsersMax) * 100) : 0,
      },
      timezone: "America/Argentina/Buenos_Aires",
      lifecycleBanners: computeLifecycleBanners(subscription),
      restrictedPolicy: SUBSCRIPTION_RESTRICTED_CAPABILITIES,
    };
  }

  async setNextTier(companyId: string, nextTier: PlanTierCode | null) {
    await this.ensureCatalog();
    await this.ensureCompanySubscription(companyId);
    const updated = await this.prisma.subscription.update({
      where: { companyId },
      data: { nextTier: nextTier ?? null },
    });
    return {
      companyId,
      nextTier: updated.nextTier,
      currentTier: updated.currentTier,
      status: updated.status,
      currentPeriodEnd: updated.currentPeriodEnd,
    };
  }

  async getSupportEntitlements(companyId: string) {
    return this.getEffective(companyId);
  }
}
