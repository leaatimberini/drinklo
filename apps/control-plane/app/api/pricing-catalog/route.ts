import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { getTokenForRole, isRoleAllowed, type Role } from "../../lib/auth";
import { hashEvidencePayload } from "../../lib/compliance-evidence";
import { signPayload } from "../../lib/signing";
import { buildPricingCatalogSnapshot, buildPricingChangeImpact, normalizeCurrency, normalizeTierCode } from "../../lib/pricing-catalog";

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

function parseDate(value: unknown, fallback?: Date | null) {
  if (value == null || value === "") return fallback ?? null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function signPricingEvidence(payload: unknown) {
  const secret =
    process.env.CONTROL_PLANE_PRICING_SIGNING_SECRET ??
    process.env.SOC2_EVIDENCE_SIGNING_SECRET ??
    process.env.CONTROL_PLANE_ADMIN_TOKEN ??
    "cp-pricing-dev";
  return signPayload(payload, secret);
}

async function recordPricingAudit(input: {
  evidenceType: string;
  capturedBy: string;
  payload: Record<string, unknown>;
  tags?: string[];
}) {
  const signature = signPricingEvidence(input.payload);
  const wrapped = { ...input.payload, evidenceSignature: signature };
  return prisma.complianceEvidence.create({
    data: {
      evidenceType: input.evidenceType,
      source: "pricing_catalog",
      payload: wrapped as any,
      payloadHash: hashEvidencePayload(wrapped),
      sourceCapturedAt: new Date(),
      capturedBy: input.capturedBy,
      tags: input.tags ?? ["billing", "pricing-catalog"],
    },
  });
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (!role || !isRoleAllowed(role, ["support", "ops", "admin"])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tier = normalizeTierCode(searchParams.get("tier"));
  const currency = normalizeCurrency(searchParams.get("currency"));
  const billingPeriod = String(searchParams.get("billingPeriod") ?? "").trim().toUpperCase();

  const where: any = {};
  if (tier) where.tier = tier;
  if (currency) where.currency = currency;
  if (billingPeriod === "MONTHLY" || billingPeriod === "YEARLY") where.billingPeriod = billingPeriod;

  const [rows, audit] = await Promise.all([
    prisma.planPrice.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true, currency: true, period: true, price: true } },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.complianceEvidence.findMany({
      where: { evidenceType: { startsWith: "pricing_catalog." } },
      orderBy: { capturedAt: "desc" },
      take: 100,
      select: { id: true, evidenceType: true, capturedAt: true, capturedBy: true, payloadHash: true, payload: true },
    }),
  ]);

  const snapshot = buildPricingCatalogSnapshot(
    rows.map((row) => ({
      ...row,
      effectiveTo: row.effectiveTo ?? null,
    })) as any,
    new Date(),
  );

  return NextResponse.json({
    items: rows,
    snapshot,
    audit,
    defaultImpactPolicy: buildPricingChangeImpact({}),
  });
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (!role || !isRoleAllowed(role, ["ops", "admin"])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const capturedBy = actor(req, role);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "create").trim().toLowerCase();

  if (action === "create" || action === "upsert") {
    const tier = normalizeTierCode(body.tier);
    const currency = normalizeCurrency(body.currency);
    const billingPeriod = String(body.billingPeriod ?? "").trim().toUpperCase();
    const amount = Number(body.amount);
    const effectiveFrom = parseDate(body.effectiveFrom);
    const effectiveTo = parseDate(body.effectiveTo, null);
    const notes = body.notes ? String(body.notes) : null;
    const propagatePolicy = buildPricingChangeImpact({
      propagateToExistingSubscriptions: Boolean(body.propagateToExistingSubscriptions),
      applyToRenewalsOnly: Boolean(body.applyToRenewalsOnly),
    });

    if (!tier || !["C1", "C2", "C3"].includes(tier)) {
      return NextResponse.json({ error: "invalid tier" }, { status: 400 });
    }
    if (!currency) return NextResponse.json({ error: "currency required" }, { status: 400 });
    if (!["MONTHLY", "YEARLY"].includes(billingPeriod)) {
      return NextResponse.json({ error: "invalid billingPeriod" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }
    if (!effectiveFrom) return NextResponse.json({ error: "invalid effectiveFrom" }, { status: 400 });
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      return NextResponse.json({ error: "effectiveTo must be > effectiveFrom" }, { status: 400 });
    }

    const plan = await prisma.billingPlan.findFirst({
      where: {
        name: { contains: tier, mode: "insensitive" },
        period: billingPeriod as any,
      },
      orderBy: { createdAt: "desc" },
    });

    const created = await prisma.$transaction(async (tx) => {
      if (body.closeOpenOverlap) {
        await tx.planPrice.updateMany({
          where: {
            tier,
            billingPeriod: billingPeriod as any,
            currency,
            effectiveTo: null,
            effectiveFrom: { lt: effectiveFrom },
          },
          data: {
            effectiveTo: effectiveFrom,
            updatedBy: capturedBy,
          },
        });
      }

      return tx.planPrice.create({
        data: {
          planId: plan?.id ?? null,
          tier,
          billingPeriod: billingPeriod as any,
          currency,
          amount,
          effectiveFrom,
          effectiveTo,
          notes,
          createdBy: capturedBy,
          updatedBy: capturedBy,
        },
        include: { plan: true },
      });
    });

    await recordPricingAudit({
      evidenceType: "pricing_catalog.price_change",
      capturedBy,
      payload: {
        action,
        planPriceId: created.id,
        tier,
        billingPeriod,
        currency,
        amount,
        effectiveFrom: created.effectiveFrom.toISOString(),
        effectiveTo: created.effectiveTo?.toISOString() ?? null,
        notes,
        impact: propagatePolicy,
      },
      tags: ["billing", "pricing-catalog", "plan-price"],
    });

    return NextResponse.json({ ok: true, item: created, impact: propagatePolicy }, { status: 201 });
  }

  if (action === "close") {
    const id = String(body.id ?? "").trim();
    const effectiveTo = parseDate(body.effectiveTo);
    if (!id || !effectiveTo) return NextResponse.json({ error: "id and effectiveTo required" }, { status: 400 });

    const updated = await prisma.planPrice.update({
      where: { id },
      data: { effectiveTo, updatedBy: capturedBy, notes: body.notes ? String(body.notes) : undefined },
      include: { plan: true },
    });
    await recordPricingAudit({
      evidenceType: "pricing_catalog.price_close",
      capturedBy,
      payload: {
        action,
        planPriceId: updated.id,
        effectiveTo: updated.effectiveTo?.toISOString() ?? null,
        notes: body.notes ? String(body.notes) : null,
      },
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
