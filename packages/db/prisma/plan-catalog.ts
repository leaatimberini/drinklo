import type { Prisma, PrismaClient } from "@prisma/client";
import type { PlanTier } from "@prisma/client";

export type PlanCatalogSeedItem = {
  tier: PlanTier;
  ordersMonth: number;
  apiCallsMonth: number;
  storageGb: number;
  pluginsMax: number;
  branchesMax: number;
  adminUsersMax: number;
  sloTarget: string;
  drFrequency: string;
  supportLevel: string;
};

export const DEFAULT_PLAN_CATALOG: readonly PlanCatalogSeedItem[] = [
  {
    tier: "C1",
    ordersMonth: 2_500,
    apiCallsMonth: 150_000,
    storageGb: 10,
    pluginsMax: 5,
    branchesMax: 1,
    adminUsersMax: 5,
    sloTarget: "99.5%",
    drFrequency: "weekly",
    supportLevel: "standard",
  },
  {
    tier: "C2",
    ordersMonth: 15_000,
    apiCallsMonth: 1_000_000,
    storageGb: 100,
    pluginsMax: 25,
    branchesMax: 5,
    adminUsersMax: 25,
    sloTarget: "99.9%",
    drFrequency: "daily",
    supportLevel: "priority",
  },
  {
    tier: "C3",
    ordersMonth: 100_000,
    apiCallsMonth: 10_000_000,
    storageGb: 1_000,
    pluginsMax: 200,
    branchesMax: 50,
    adminUsersMax: 250,
    sloTarget: "99.95%",
    drFrequency: "4h",
    supportLevel: "enterprise",
  },
] as const;

export function buildTrialWindow(baseDate = new Date(), trialDays = 30) {
  const start = new Date(baseDate);
  const end = new Date(baseDate);
  end.setUTCDate(end.getUTCDate() + trialDays);
  return { start, end };
}

export async function seedDefaultPlanCatalog(
  client: Pick<PrismaClient, "planEntitlement">,
) {
  for (const item of DEFAULT_PLAN_CATALOG) {
    await client.planEntitlement.upsert({
      where: { tier: item.tier },
      update: {
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
      create: item satisfies Prisma.PlanEntitlementCreateInput,
    });
  }
}

