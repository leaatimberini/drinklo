import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getAuthorizedPartnerByPortalCredentials } from "../../../../lib/partner-auth";
import { parseBaDateRange } from "../../../../lib/partner-program";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

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
  const conversions = await prisma.conversion.findMany({
    where: {
      partnerId: partner.id,
      createdAt: { gte: range.fromUtc, lte: range.toUtc },
    },
    include: {
      referralLink: { select: { code: true } },
      billingAccount: { select: { instanceId: true, clientName: true } },
      commissionPlan: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    [
      "conversion_id",
      "status",
      "instance_id",
      "client_name",
      "referral_code",
      "commission_plan",
      "estimated_revenue",
      "estimated_commission",
      "currency",
      "fraud_score",
      "created_at",
    ].join(","),
    ...conversions.map((row) =>
      [
        row.id,
        row.status,
        row.billingAccount?.instanceId ?? row.instanceId ?? "",
        row.billingAccount?.clientName ?? "",
        row.referralLink?.code ?? "",
        row.commissionPlan?.name ?? "",
        row.estimatedRevenueAmount ?? 0,
        row.estimatedCommissionAmount ?? 0,
        row.commissionCurrency ?? "ARS",
        row.fraudScore ?? 0,
        row.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="partner-${partner.slug}-${range.from}-${range.to}.csv"`,
    },
  });
}

