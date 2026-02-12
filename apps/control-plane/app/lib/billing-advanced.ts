export type BillingTier = {
  upToOrders?: number;
  upToGmvArs?: number;
  unitPriceArs: number;
};

export type PlanPricingInput = {
  basePrice: number;
  includedOrdersPerMonth: number;
  overagePerOrderArs: number;
  gmvIncludedArs: number;
  gmvTiers?: BillingTier[];
};

export type UsageInput = {
  monthlyOrders: number;
  monthlyGmvArs: number;
};

export type PricingResult = {
  totalArs: number;
  overageOrders: number;
  overageOrdersAmount: number;
  gmvTierAmount: number;
  tierMatched: BillingTier | null;
};

export type TrialState = "ACTIVE" | "WARNING" | "EXPIRED";

export type EnforcementState = {
  status: TrialState;
  warnings: string[];
  softLimitPremium: boolean;
  hardLimitPremium: boolean;
  basicSalesAllowed: true;
};

export function calculateDynamicPricing(plan: PlanPricingInput, usage: UsageInput): PricingResult {
  const overageOrders = Math.max(0, usage.monthlyOrders - Math.max(0, plan.includedOrdersPerMonth || 0));
  const overageOrdersAmount = overageOrders * Math.max(0, plan.overagePerOrderArs || 0);

  const gmvOverage = Math.max(0, usage.monthlyGmvArs - Math.max(0, plan.gmvIncludedArs || 0));
  const tiers = [...(plan.gmvTiers ?? [])].sort((a, b) => (a.upToGmvArs ?? Number.MAX_SAFE_INTEGER) - (b.upToGmvArs ?? Number.MAX_SAFE_INTEGER));
  let tierMatched: BillingTier | null = null;
  let gmvTierAmount = 0;
  for (const tier of tiers) {
    const maxGmv = tier.upToGmvArs ?? Number.MAX_SAFE_INTEGER;
    const maxOrders = tier.upToOrders ?? Number.MAX_SAFE_INTEGER;
    if (usage.monthlyGmvArs <= maxGmv && usage.monthlyOrders <= maxOrders) {
      tierMatched = tier;
      gmvTierAmount = gmvOverage * Math.max(0, tier.unitPriceArs);
      break;
    }
  }

  const totalArs = Number((Math.max(0, plan.basePrice) + overageOrdersAmount + gmvTierAmount).toFixed(2));
  return {
    totalArs,
    overageOrders,
    overageOrdersAmount: Number(overageOrdersAmount.toFixed(2)),
    gmvTierAmount: Number(gmvTierAmount.toFixed(2)),
    tierMatched,
  };
}

export function evaluateTrialAndEnforcement(params: {
  now: Date;
  trialEndsAt?: Date | null;
  invoicePastDueDays?: number;
  premiumFeaturesEnabled?: boolean;
}): EnforcementState {
  const warnings: string[] = [];
  const trialEndsAt = params.trialEndsAt ?? null;
  const premium = params.premiumFeaturesEnabled !== false;

  if (!trialEndsAt) {
    return {
      status: "ACTIVE",
      warnings,
      softLimitPremium: false,
      hardLimitPremium: false,
      basicSalesAllowed: true,
    };
  }

  const diffMs = params.now.getTime() - trialEndsAt.getTime();
  const daysAfterTrial = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const dueDays = Math.max(0, params.invoicePastDueDays ?? 0);

  if (daysAfterTrial <= -1) {
    const daysLeft = Math.ceil(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
    if (daysLeft <= 3) warnings.push(`Trial termina en ${daysLeft} dia(s)`);
    return {
      status: "ACTIVE",
      warnings,
      softLimitPremium: false,
      hardLimitPremium: false,
      basicSalesAllowed: true,
    };
  }

  if (daysAfterTrial <= 3 || dueDays <= 7) {
    warnings.push("Trial vencido o cuenta en grace period. Premium con advertencia.");
    return {
      status: "WARNING",
      warnings,
      softLimitPremium: false,
      hardLimitPremium: false,
      basicSalesAllowed: true,
    };
  }

  if (daysAfterTrial <= 14 || dueDays <= 30) {
    warnings.push("Limite soft activo: premium restringido hasta regularizar.");
    return {
      status: "EXPIRED",
      warnings,
      softLimitPremium: premium,
      hardLimitPremium: false,
      basicSalesAllowed: true,
    };
  }

  warnings.push("Limite hard para premium por mora extendida.");
  return {
    status: "EXPIRED",
    warnings,
    softLimitPremium: premium,
    hardLimitPremium: premium,
    basicSalesAllowed: true,
  };
}

export function calculateProration(params: {
  fromPlanAmount: number;
  toPlanAmount: number;
  periodStart: Date;
  periodEnd: Date;
  effectiveAt: Date;
}) {
  const totalMs = Math.max(1, params.periodEnd.getTime() - params.periodStart.getTime());
  const usedMs = Math.min(totalMs, Math.max(0, params.effectiveAt.getTime() - params.periodStart.getTime()));
  const remainingRatio = (totalMs - usedMs) / totalMs;
  const fromCredit = Math.max(0, params.fromPlanAmount) * remainingRatio;
  const toCharge = Math.max(0, params.toPlanAmount) * remainingRatio;
  const prorationAmount = Number((toCharge - fromCredit).toFixed(2));

  return {
    remainingRatio: Number(remainingRatio.toFixed(4)),
    fromCredit: Number(fromCredit.toFixed(2)),
    toCharge: Number(toCharge.toFixed(2)),
    prorationAmount,
  };
}
