export type PricingCurrency = "USD" | "ARS" | string;
export type PricingBillingPeriod = "MONTHLY" | "YEARLY";

export type PlanPriceRow = {
  id?: string;
  tier: string;
  billingPeriod: PricingBillingPeriod;
  currency: PricingCurrency;
  amount: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  notes?: string | null;
  createdAt?: Date;
};

export function normalizeCurrency(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function normalizeTierCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function isPriceActiveAt(row: PlanPriceRow, at: Date) {
  const startOk = row.effectiveFrom.getTime() <= at.getTime();
  const endOk = !row.effectiveTo || row.effectiveTo.getTime() > at.getTime();
  return startOk && endOk;
}

export function comparePricePriority(a: PlanPriceRow, b: PlanPriceRow) {
  const byFrom = b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  if (byFrom !== 0) return byFrom;
  const byCreated = (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  if (byCreated !== 0) return byCreated;
  return String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

export function resolveCurrentAndNextPlanPrice(rows: PlanPriceRow[], at = new Date()) {
  const sorted = [...rows].sort(comparePricePriority);
  const current = sorted.find((row) => isPriceActiveAt(row, at)) ?? null;
  const next = [...rows]
    .filter((row) => row.effectiveFrom.getTime() > at.getTime())
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || comparePricePriority(a, b))[0] ?? null;
  return { current, next };
}

export function buildPricingChangeImpact(input: {
  propagateToExistingSubscriptions?: boolean;
  applyToRenewalsOnly?: boolean;
}) {
  const propagate = Boolean(input.propagateToExistingSubscriptions);
  const renewalsOnly = Boolean(input.applyToRenewalsOnly);
  return {
    affectsExistingSubscriptions: propagate,
    policy: propagate ? (renewalsOnly ? "RENEWALS_ONLY" : "IMMEDIATE_PROPAGATION") : "CATALOG_ONLY",
    message: propagate
      ? renewalsOnly
        ? "Price change applies to renewals only (explicit policy)."
        : "Price change may impact existing subscriptions immediately (explicit policy)."
      : "Catalog pricing change only; existing subscriptions are not modified by default.",
  };
}

export function buildPricingCatalogSnapshot(rows: PlanPriceRow[], at = new Date()) {
  const groups = new Map<string, PlanPriceRow[]>();
  for (const row of rows) {
    const key = `${normalizeTierCode(row.tier)}|${row.billingPeriod}|${normalizeCurrency(row.currency)}`;
    const list = groups.get(key) ?? [];
    list.push({
      ...row,
      tier: normalizeTierCode(row.tier),
      currency: normalizeCurrency(row.currency),
    });
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const [tier, billingPeriod, currency] = key.split("|");
      const resolved = resolveCurrentAndNextPlanPrice(list, at);
      return {
        tier,
        billingPeriod,
        currency,
        current: resolved.current,
        next: resolved.next,
      };
    })
    .sort((a, b) =>
      a.tier.localeCompare(b.tier) ||
      a.billingPeriod.localeCompare(b.billingPeriod) ||
      a.currency.localeCompare(b.currency),
    );
}

