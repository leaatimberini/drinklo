import { buildControlPlaneUrl } from "./marketing-site";

export type PublicPricingRow = {
  tier: string;
  billingPeriod: "MONTHLY" | "YEARLY";
  currency: string;
  current?: { amount: number; effectiveFrom: string } | null;
  next?: { amount: number; effectiveFrom: string } | null;
};

export async function fetchPublicPricingCatalog() {
  const directUrl = buildControlPlaneUrl("/api/pricing-catalog/public");
  const res = await fetch(directUrl, { next: { revalidate: 300 } }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}

export function selectMonthlyTierPrices(input: { snapshot?: PublicPricingRow[] } | null) {
  const rows: PublicPricingRow[] = Array.isArray(input?.snapshot) ? input.snapshot : [];
  return ["C1", "C2", "C3"].map((tier) => {
    const monthly = rows.filter((row) => row.tier === tier && row.billingPeriod === "MONTHLY");
    const byCurrency = new Map(monthly.map((row) => [row.currency, row]));
    return {
      tier,
      usd: byCurrency.get("USD") ?? null,
      ars: byCurrency.get("ARS") ?? null,
      all: monthly,
    };
  });
}
