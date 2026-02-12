import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { calculateDynamicPricing, evaluateTrialAndEnforcement } from "../../../lib/billing-advanced";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-portal-token") ?? "";
  const expected = process.env.CONTROL_PLANE_BILLING_PORTAL_TOKEN ?? "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get("instanceId");
  if (!instanceId) return NextResponse.json({ error: "instanceId required" }, { status: 400 });

  const account = await prisma.billingAccount.findUnique({
    where: { instanceId },
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 50 },
      usageRecords: { orderBy: { createdAt: "desc" }, take: 50 },
      planChanges: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });
  const plans = await prisma.billingPlan.findMany({ orderBy: { price: "asc" } });
  const openInvoice = account.invoices.find((invoice) => invoice.status === "OPEN");
  const pastDueDays = openInvoice
    ? Math.max(0, Math.floor((Date.now() - openInvoice.dueAt.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const enforcement = evaluateTrialAndEnforcement({
    now: new Date(),
    trialEndsAt: account.trialEndsAt,
    invoicePastDueDays: pastDueDays,
    premiumFeaturesEnabled: true,
  });
  const usagePricing = calculateDynamicPricing(
    {
      basePrice: account.plan.price,
      includedOrdersPerMonth: account.plan.includedOrdersPerMonth,
      overagePerOrderArs: account.plan.overagePerOrderArs,
      gmvIncludedArs: account.plan.gmvIncludedArs,
      gmvTiers: (account.plan.gmvTiers as any) ?? [],
    },
    {
      monthlyOrders: account.monthlyOrders,
      monthlyGmvArs: account.monthlyGmvArs,
    },
  );

  return NextResponse.json({
    account: {
      instanceId: account.instanceId,
      clientName: account.clientName,
      email: account.email,
      status: account.status,
      plan: account.plan,
      nextBillingAt: account.nextBillingAt,
      trialEndsAt: account.trialEndsAt,
      currentPeriodStart: account.currentPeriodStart,
      currentPeriodEnd: account.currentPeriodEnd,
      monthlyOrders: account.monthlyOrders,
      monthlyGmvArs: account.monthlyGmvArs,
      warnings: enforcement.warnings,
      softLimitPremium: enforcement.softLimitPremium,
      hardLimitPremium: enforcement.hardLimitPremium,
      pricingPreview: usagePricing,
    },
    invoices: account.invoices,
    usage: account.usageRecords,
    history: account.planChanges,
    plans,
  });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-portal-token") ?? "";
  const expected = process.env.CONTROL_PLANE_BILLING_PORTAL_TOKEN ?? "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const instanceId = String(body.instanceId ?? "").trim();
  const targetPlanId = String(body.targetPlanId ?? "").trim();
  if (!instanceId || !targetPlanId) {
    return NextResponse.json({ error: "instanceId and targetPlanId required" }, { status: 400 });
  }

  const adminToken = process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "";
  if (!adminToken) {
    return NextResponse.json({ error: "missing admin token" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const response = await fetch(`${origin}/api/billing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "changePlan",
      instanceId,
      targetPlanId,
      reason: "customer_portal",
    }),
  });
  const payload = await response.json().catch(() => ({ error: "invalid response" }));
  return NextResponse.json(payload, { status: response.status });
}
