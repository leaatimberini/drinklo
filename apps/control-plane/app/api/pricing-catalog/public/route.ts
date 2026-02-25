import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { buildPricingCatalogSnapshot } from "../../../lib/pricing-catalog";

function inferTierFromPlanName(name?: string | null) {
  const normalized = String(name ?? "").toUpperCase();
  for (const tier of ["C1", "C2", "C3"] as const) {
    if (normalized === tier || normalized.startsWith(`${tier} `) || normalized.includes(` ${tier} `)) return tier;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const at = searchParams.get("at") ? new Date(String(searchParams.get("at"))) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "invalid at" }, { status: 400 });
  }

  const [planPrices, billingPlans] = await Promise.all([
    prisma.planPrice.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 2000,
    }),
    prisma.billingPlan.findMany({
      orderBy: [{ period: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const synthesizedFallbackRows =
    planPrices.length === 0
      ? billingPlans
          .map((plan) => {
            const tier = inferTierFromPlanName(plan.name);
            if (!tier) return null;
            return {
              id: `fallback-${plan.id}`,
              planId: plan.id,
              tier,
              billingPeriod: plan.period,
              currency: plan.currency || "USD",
              amount: Number(plan.price ?? 0),
              effectiveFrom: plan.createdAt,
              effectiveTo: null,
              notes: "fallback_from_billing_plan",
              createdAt: plan.createdAt,
            };
          })
          .filter(Boolean)
      : [];

  const rows = (planPrices.length > 0 ? planPrices : synthesizedFallbackRows) as any[];
  const snapshot = buildPricingCatalogSnapshot(
    rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      effectiveTo: row.effectiveTo ?? null,
      effectiveFrom: new Date(row.effectiveFrom),
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    })),
    at,
  );

  const tiers = ["C1", "C2", "C3"].map((tier) => ({
    tier,
    monthly: snapshot.filter((row) => row.tier === tier && row.billingPeriod === "MONTHLY"),
    yearly: snapshot.filter((row) => row.tier === tier && row.billingPeriod === "YEARLY"),
  }));

  return NextResponse.json(
    {
      at,
      source: planPrices.length > 0 ? "plan_price" : "billing_plan_fallback",
      snapshot,
      tiers,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

