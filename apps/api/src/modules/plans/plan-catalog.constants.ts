export type PlanTierCode = "C1" | "C2" | "C3";
export type PlanSubscriptionStatusCode =
  | "TRIAL_ACTIVE"
  | "ACTIVE_PAID"
  | "PAST_DUE"
  | "GRACE"
  | "RESTRICTED"
  | "CANCELLED";

export type PlanEntitlementCatalogItem = {
  tier: PlanTierCode;
  monthlyPriceArs: number;
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

export const PLAN_CATALOG_DEFAULTS: readonly PlanEntitlementCatalogItem[] = [
  {
    tier: "C1",
    monthlyPriceArs: 49900,
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
    monthlyPriceArs: 149900,
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
    monthlyPriceArs: 399900,
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
