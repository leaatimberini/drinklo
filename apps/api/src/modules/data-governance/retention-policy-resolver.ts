import { GovernanceEntity } from "@erp/db";

export type GovernancePlanTier = "starter" | "pro" | "enterprise";

export const GOVERNANCE_ENTITIES: GovernanceEntity[] = [
  GovernanceEntity.ORDERS,
  GovernanceEntity.LOGS,
  GovernanceEntity.EVENTS,
  GovernanceEntity.MARKETING,
];

export const DEFAULT_RETENTION_MATRIX: Record<GovernancePlanTier, Record<GovernanceEntity, number>> = {
  starter: {
    ORDERS: 180,
    LOGS: 30,
    EVENTS: 60,
    MARKETING: 90,
  },
  pro: {
    ORDERS: 365,
    LOGS: 90,
    EVENTS: 180,
    MARKETING: 365,
  },
  enterprise: {
    ORDERS: 730,
    LOGS: 365,
    EVENTS: 365,
    MARKETING: 730,
  },
};

export function normalizeGovernancePlan(plan?: string | null): GovernancePlanTier {
  const normalized = String(plan ?? "pro").toLowerCase();
  if (normalized === "starter" || normalized === "enterprise" || normalized === "pro") {
    return normalized;
  }
  return "pro";
}

export function resolveEffectivePolicy(
  plan: string | null | undefined,
  overrides: Array<{ entity: GovernanceEntity; retentionDays: number }>,
) {
  const normalizedPlan = normalizeGovernancePlan(plan);
  const map = new Map(overrides.map((item) => [item.entity, item.retentionDays]));
  return GOVERNANCE_ENTITIES.map((entity) => ({
    entity,
    retentionDays: map.get(entity) ?? DEFAULT_RETENTION_MATRIX[normalizedPlan][entity],
    source: map.has(entity) ? "override" : "default",
  }));
}
