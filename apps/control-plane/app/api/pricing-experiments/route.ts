import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { getTokenForRole, isRoleAllowed, type Role } from "../../lib/auth";
import { assignPricingExperimentsForContext, getPricingExperimentResults, upsertPricingExperiment } from "../../lib/pricing-experiments";

function getRole(req: NextRequest): Role | null {
  const header = req.headers.get("x-cp-admin-token");
  if (header && header === process.env.CONTROL_PLANE_ADMIN_TOKEN) return "admin";
  const role = req.cookies.get("cp_role")?.value as Role | undefined;
  const token = req.cookies.get("cp_token")?.value;
  if (!role || !token) return null;
  const expected = getTokenForRole(role);
  if (!expected || token !== expected) return null;
  return role;
}

function actor(req: NextRequest, fallbackRole: string) {
  return (req.headers.get("x-cp-actor") ?? req.cookies.get("cp_actor")?.value ?? fallbackRole).trim();
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (!role || !isRoleAllowed(role, ["support", "ops", "admin"])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [experiments, assignments, results] = await Promise.all([
    prisma.pricingExperiment.findMany({ include: { variants: true }, orderBy: [{ createdAt: "desc" }], take: 200 }),
    prisma.pricingExperimentAssignment.findMany({
      include: { experiment: true, variant: true },
      orderBy: [{ assignedAt: "desc" }],
      take: 200,
    }),
    getPricingExperimentResults(prisma as any),
  ]);

  return NextResponse.json({ experiments, assignments, results });
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (!role || !isRoleAllowed(role, ["ops", "admin"])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "upsert").toLowerCase();
  const by = actor(req, role);

  try {
    if (action === "upsert") {
      const experiment = await upsertPricingExperiment(prisma as any, body, by);
      return NextResponse.json({ ok: true, experiment });
    }
    if (action === "preview_assign") {
      const cookieId = body.cookieId ? String(body.cookieId) : "preview-cookie";
      const assigned = await assignPricingExperimentsForContext(prisma as any, {
        instanceId: body.instanceId ? String(body.instanceId) : null,
        installationId: body.installationId ? String(body.installationId) : null,
        billingAccountId: null,
        leadAttributionId: null,
        trialRedemptionId: null,
        cookieId,
        emailDomain: body.emailDomain ? String(body.emailDomain) : null,
        targetTier: body.targetTier ? String(body.targetTier) : null,
        trialCode: body.trialCode ? String(body.trialCode) : null,
        icp: body.icp ? String(body.icp) : null,
        source: "preview",
        actor: by,
      });
      return NextResponse.json({ ok: true, assignments: assigned.assignments });
    }
    if (action === "set_status") {
      const id = String(body.id ?? "").trim();
      const status = String(body.status ?? "").trim().toUpperCase();
      if (!id || !["DRAFT", "ACTIVE", "PAUSED", "ENDED"].includes(status)) {
        return NextResponse.json({ error: "invalid id/status" }, { status: 400 });
      }
      const experiment = await prisma.pricingExperiment.update({ where: { id }, data: { status: status as any, updatedBy: by } });
      return NextResponse.json({ ok: true, experiment });
    }
    if (action === "apply_offer_to_account") {
      const accountId = String(body.accountId ?? "").trim();
      if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
      const account = await prisma.billingAccount.findUnique({ where: { id: accountId }, include: { plan: true } });
      if (!account) return NextResponse.json({ error: "account not found" }, { status: 404 });
      const assigned = await assignPricingExperimentsForContext(prisma as any, {
        instanceId: account.instanceId,
        installationId: account.installationId,
        billingAccountId: account.id,
        cookieId: body.cookieId ? String(body.cookieId) : null,
        emailDomain: account.email?.split("@")[1] ?? null,
        targetTier: String(account.plan?.name ?? "").match(/C[123]/i)?.[0]?.toUpperCase() ?? body.targetTier ?? null,
        trialCode: body.trialCode ? String(body.trialCode) : null,
        icp: body.icp ? String(body.icp) : null,
        source: "support_apply",
        actor: by,
      });
      return NextResponse.json({ ok: true, assignments: assigned.assignments });
    }
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "pricing_experiment_failed" }, { status: 400 });
  }
}
