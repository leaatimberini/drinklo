import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getAuthorizedPartnerByPortalCredentials } from "../../../../lib/partner-auth";
import {
  hashCertificationPayload,
  validatePartnerCertificationReport,
  verifyCertificationReportSignature,
} from "../../../../lib/partner-certification";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const partner = await getAuthorizedPartnerByPortalCredentials({
    slug: sp.get("partner"),
    token: sp.get("token"),
  });
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [runs, certifications] = await Promise.all([
    prisma.partnerCertificationRun.findMany({
      where: { partnerId: partner.id },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
    prisma.partnerCertification.findMany({
      where: { partnerId: partner.id },
      orderBy: { issuedAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({ runs, certifications });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const partner = await getAuthorizedPartnerByPortalCredentials({
    slug: body.partner ? String(body.partner) : null,
    token: body.token ? String(body.token) : null,
  });
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report = body.report;
  const signature = String(body.signature ?? "").trim();
  if (!report || typeof report !== "object" || !signature) {
    return NextResponse.json({ error: "report and signature are required" }, { status: 400 });
  }

  if (!verifyCertificationReportSignature(report, signature, String(body.token))) {
    return NextResponse.json({ error: "invalid report signature" }, { status: 401 });
  }

  const validation = validatePartnerCertificationReport(report);
  const run = await prisma.partnerCertificationRun.create({
    data: {
      partnerId: partner.id,
      kitVersion: String((report as any)?.kitVersion ?? "unknown"),
      reportPayload: report,
      reportHash: hashCertificationPayload(report),
      signature,
      status: validation.passed ? "PASSED" : "FAILED",
      score: validation.score,
      validationErrors: validation.errors,
      validationSummary: {
        warnings: validation.warnings,
        summary: validation.summary,
      },
      validatedAt: new Date(),
    },
  });

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    score: run.score,
    validation,
  });
}

