export type TierRule = {
  maxOrders?: number;
  maxGmvArs?: number;
  priceMultiplier: number;
};

export function resolveTier(params: {
  basePlan: string;
  monthlyOrders: number;
  monthlyGmvArs: number;
  tiers: TierRule[];
}) {
  for (const tier of params.tiers) {
    const withinOrders = tier.maxOrders == null || params.monthlyOrders <= tier.maxOrders;
    const withinGmv = tier.maxGmvArs == null || params.monthlyGmvArs <= tier.maxGmvArs;
    if (withinOrders && withinGmv) {
      return tier;
    }
  }
  return params.tiers[params.tiers.length - 1] ?? { priceMultiplier: 1 };
}

export function trialState(now: Date, trialEndsAt?: Date | null) {
  if (!trialEndsAt) return "inactive" as const;
  if (now.getTime() <= trialEndsAt.getTime()) return "active" as const;
  const days = Math.floor((now.getTime() - trialEndsAt.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 3) return "grace" as const;
  return "expired" as const;
}

export function proration(params: {
  oldAmount: number;
  newAmount: number;
  periodStart: Date;
  periodEnd: Date;
  changeAt: Date;
}) {
  const total = Math.max(1, params.periodEnd.getTime() - params.periodStart.getTime());
  const used = Math.min(total, Math.max(0, params.changeAt.getTime() - params.periodStart.getTime()));
  const remaining = (total - used) / total;
  const credit = params.oldAmount * remaining;
  const charge = params.newAmount * remaining;
  return Number((charge - credit).toFixed(2));
}
