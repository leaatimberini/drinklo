import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { generatePortalToken, hashPartnerToken } from "../../../lib/partner-program";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const partners = await prisma.partner.findMany({
    include: {
      commissionPlans: { orderBy: { createdAt: "desc" } },
      referralLinks: { orderBy: { createdAt: "desc" } },
      _count: { select: { leads: true, conversions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    partners: partners.map((partner) => ({
      ...partner,
      portalTokenHash: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "").trim();

  if (kind === "partner") {
    const slug = String(body.slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || !body.name) {
      return NextResponse.json({ error: "name and slug required" }, { status: 400 });
    }
    const portalToken = generatePortalToken();
    const partner = await prisma.partner.create({
      data: {
        name: String(body.name),
        slug,
        contactEmail: body.contactEmail ? String(body.contactEmail) : null,
        websiteDomain: body.websiteDomain ? String(body.websiteDomain).toLowerCase() : null,
        notes: body.notes ? String(body.notes) : null,
        portalTokenHash: hashPartnerToken(portalToken),
      },
    });
    return NextResponse.json({
      partner: { ...partner, portalTokenHash: undefined },
      portalToken,
    });
  }

  if (kind === "commissionPlan") {
    const partnerId = String(body.partnerId ?? "").trim();
    if (!partnerId || !body.name) {
      return NextResponse.json({ error: "partnerId and name required" }, { status: 400 });
    }
    const plan = await prisma.commissionPlan.create({
      data: {
        partnerId,
        name: String(body.name),
        type: body.type ?? "PERCENT_REVENUE",
        percentRate: Number(body.percentRate ?? 0),
        flatAmount: Number(body.flatAmount ?? 0),
        currency: String(body.currency ?? "ARS"),
        cookieTtlDays: Number(body.cookieTtlDays ?? 30),
        recurringInvoiceCap: body.recurringInvoiceCap != null ? Number(body.recurringInvoiceCap) : null,
        active: body.active !== false,
        isDefault: body.isDefault === true,
      },
    });
    if (plan.isDefault) {
      await prisma.commissionPlan.updateMany({
        where: { partnerId, id: { not: plan.id } },
        data: { isDefault: false },
      });
    }
    return NextResponse.json(plan);
  }

  if (kind === "referralLink") {
    const partnerId = String(body.partnerId ?? "").trim();
    const code = String(body.code ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");
    if (!partnerId || !code || !body.label) {
      return NextResponse.json({ error: "partnerId, code, label required" }, { status: 400 });
    }
    const link = await prisma.referralLink.create({
      data: {
        partnerId,
        code,
        label: String(body.label),
        targetUrl: body.targetUrl ? String(body.targetUrl) : null,
        commissionPlanId: body.commissionPlanId ? String(body.commissionPlanId) : null,
        metadata: body.metadata ?? undefined,
      },
    });
    return NextResponse.json(link);
  }

  return NextResponse.json({ error: "unsupported kind" }, { status: 400 });
}

