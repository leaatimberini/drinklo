import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { buildPricingChangeImpact, normalizeCurrency, normalizeTierCode, resolveCurrentAndNextPlanPrice } from "../../../lib/pricing-catalog";
import { getTokenForRole, isRoleAllowed, type Role } from "../../../lib/auth";

function authRole(req: NextRequest): Role | null {
  const portalToken = req.headers.get("x-portal-token") ?? "";
  const expectedPortal = process.env.CONTROL_PLANE_BILLING_PORTAL_TOKEN ?? "";
  if (portalToken && expectedPortal && portalToken === expectedPortal) {
    return "support";
  }
  const header = req.headers.get("x-cp-admin-token");
  if (header && header === process.env.CONTROL_PLANE_ADMIN_TOKEN) return "admin";
  const role = req.cookies.get("cp_role")?.value as Role | undefined;
  const token = req.cookies.get("cp_token")?.value;
  if (!role || !token) return null;
  const expected = getTokenForRole(role);
  return expected && token === expected ? role : null;
}

function parseTierFromPlanName(name?: string | null) {
  const normalized = String(name ?? "").toUpperCase();
  for (const tier of ["C1", "C2", "C3"] as const) {
    if (normalized === tier || normalized.startsWith(`${tier} `) || normalized.includes(` ${tier} `)) return tier;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const role = authRole(req);
  if (!role || !isRoleAllowed(role, ["support", "ops", "admin"])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const atRaw = searchParams.get("at");
  const at = atRaw ? new Date(atRaw) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "invalid at" }, { status: 400 });
  }

  let tier = normalizeTierCode(searchParams.get("tier"));
  const billingPeriod = String(searchParams.get("billingPeriod") ?? "MONTHLY").toUpperCase();
  const currency = normalizeCurrency(searchParams.get("currency") ?? "");
  const instanceId = String(searchParams.get("instanceId") ?? "").trim();

  let account: any = null;
  if (!tier && instanceId) {
    account = await prisma.billingAccount.findUnique({
      where: { instanceId },
      include: { plan: true },
    });
    if (!account) return NextResponse.json({ error: "billing account not found" }, { status: 404 });
    tier = parseTierFromPlanName(account.plan?.name) ?? "";
  }

  if (!tier || !["C1", "C2", "C3"].includes(tier)) {
    return NextResponse.json({ error: "tier or resolvable instanceId required" }, { status: 400 });
  }
  if (!["MONTHLY", "YEARLY"].includes(billingPeriod)) {
    return NextResponse.json({ error: "invalid billingPeriod" }, { status: 400 });
  }

  const where: any = {
    tier,
    billingPeriod,
  };
  if (currency) where.currency = currency;

  const rows = await prisma.planPrice.findMany({
    where,
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.currency.toUpperCase();
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const prices = [...grouped.entries()]
    .map(([ccy, ccyRows]) => ({
      currency: ccy,
      ...resolveCurrentAndNextPlanPrice(
        ccyRows.map((r) => ({
          ...r,
          amount: Number(r.amount),
          effectiveTo: r.effectiveTo ?? null,
        })) as any,
        at,
      ),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return NextResponse.json({
    at,
    tier,
    billingPeriod,
    instanceId: account?.instanceId ?? (instanceId || null),
    account: account
      ? {
          id: account.id,
          status: account.status,
          planId: account.planId,
          planName: account.plan?.name ?? null,
          currentPeriodEnd: account.currentPeriodEnd,
        }
      : null,
    prices,
    currentPrice: currency ? prices.find((p) => p.currency === currency)?.current ?? null : null,
    nextPrice: currency ? prices.find((p) => p.currency === currency)?.next ?? null : null,
    impactDefault: buildPricingChangeImpact({}),
  });
}
