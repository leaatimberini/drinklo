import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  computePartnerCertificationExpiry,
  generateCertificateNumber,
  resolvePartnerCertificationStatus,
} from "../../../../lib/partner-certification";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const partnerId = req.nextUrl.searchParams.get("partnerId");
  const items = await prisma.partnerCertification.findMany({
    where: partnerId ? { partnerId } : undefined,
    include: {
      partner: { select: { id: true, name: true, slug: true, status: true } },
      run: { select: { id: true, status: true, score: true, submittedAt: true, kitVersion: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      computedStatus: resolvePartnerCertificationStatus({ status: item.status, expiresAt: item.expiresAt }),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const partnerId = String(body.partnerId ?? "").trim();
  const runId = String(body.runId ?? "").trim();
  const validityDays = body.validityDays == null ? undefined : Number(body.validityDays);
  const issuedBy = String(body.issuedBy ?? "admin").trim() || "admin";
  const notes = body.notes ? String(body.notes) : null;

  if (!partnerId || !runId) {
    return NextResponse.json({ error: "partnerId and runId required" }, { status: 400 });
  }

  const [partner, run] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId } }),
    prisma.partnerCertificationRun.findUnique({ where: { id: runId } }),
  ]);
  if (!partner) return NextResponse.json({ error: "partner not found" }, { status: 404 });
  if (!run || run.partnerId !== partner.id) return NextResponse.json({ error: "run not found for partner" }, { status: 404 });
  if (run.status !== "PASSED") {
    return NextResponse.json({ error: "only PASSED runs can be certified" }, { status: 409 });
  }

  const issuedAt = new Date();
  const expiresAt = computePartnerCertificationExpiry(issuedAt, validityDays);
  const cert = await prisma.partnerCertification.create({
    data: {
      partnerId: partner.id,
      runId: run.id,
      scope: "INTEGRATION_PARTNER",
      status: "ACTIVE",
      certificateNo: generateCertificateNumber(partner.slug, issuedAt),
      issuedBy,
      issuedAt,
      expiresAt,
      payload: {
        notes,
        runSummary: run.validationSummary,
        runScore: run.score,
        kitVersion: run.kitVersion,
      },
      evidenceHash: String(run.reportHash),
    },
  });

  return NextResponse.json({ certification: cert });
}

