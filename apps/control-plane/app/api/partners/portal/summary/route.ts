import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getAuthorizedPartnerByPortalCredentials } from "../../../../lib/partner-auth";
import { parseBaDateRange } from "../../../../lib/partner-program";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const partner = await getAuthorizedPartnerByPortalCredentials({
    slug: sp.get("partner"),
    token: sp.get("token"),
  });
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const range = parseBaDateRange({ from: sp.get("from"), to: sp.get("to") });
  const leads = await prisma.lead.findMany({
    where: {
      partnerId: partner.id,
      createdAt: { gte: range.fromUtc, lte: range.toUtc },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const conversions = await prisma.conversion.findMany({
    where: {
      partnerId: partner.id,
      createdAt: { gte: range.fromUtc, lte: range.toUtc },
    },
    include: {
      referralLink: { select: { code: true, label: true } },
      billingAccount: { select: { instanceId: true, clientName: true, email: true } },
      lead: { select: { email: true, utmSource: true, utmCampaign: true } },
      commissionPlan: { select: { name: true, type: true, percentRate: true, flatAmount: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const summary = {
    leads: leads.length,
    qualifiedLeads: leads.filter((l) => l.status !== "DISQUALIFIED").length,
    conversions: conversions.length,
    approvedConversions: conversions.filter((c) => c.status === "APPROVED" || c.status === "ATTRIBUTED").length,
    reviewConversions: conversions.filter((c) => c.status === "REVIEW").length,
    rejectedConversions: conversions.filter((c) => c.status === "REJECTED").length,
    estimatedRevenue: conversions.reduce((sum, c) => sum + (c.estimatedRevenueAmount ?? 0), 0),
    estimatedCommission: conversions.reduce((sum, c) => sum + (c.estimatedCommissionAmount ?? 0), 0),
    fraudFlags: leads.filter((l) => Array.isArray(l.fraudFlags) && l.fraudFlags.length > 0).length
      + conversions.filter((c) => Array.isArray(c.fraudFlags) && c.fraudFlags.length > 0).length,
  };

  return NextResponse.json({
    partner: {
      id: partner.id,
      name: partner.name,
      slug: partner.slug,
      contactEmail: partner.contactEmail,
      websiteDomain: partner.websiteDomain,
      status: partner.status,
    },
    range,
    summary,
    leads,
    conversions,
  });
}

