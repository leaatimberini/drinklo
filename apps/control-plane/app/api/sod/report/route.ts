import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

function isIngestAuthorized(req: Request) {
  const expected = process.env.CONTROL_PLANE_INGEST_TOKEN ?? "";
  if (!expected) return false;
  const token = req.headers.get("x-cp-ingest-token") ?? "";
  return token === expected;
}

export async function POST(req: Request) {
  if (!isIngestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const instanceId = String(body.instanceId ?? "").trim();
  const companyId = body.companyId ? String(body.companyId) : null;
  const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics : {};
  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }
  if (Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: "invalid capturedAt" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({
    where: { instanceId },
    select: { id: true },
  });

  const report = await prisma.sodAccessReviewReport.create({
    data: {
      installationId: installation?.id ?? null,
      instanceId,
      companyId,
      capturedAt,
      activePolicies: Number(metrics.activePolicies ?? 0) || 0,
      totalPolicies: Number(metrics.totalPolicies ?? 0) || 0,
      violations24h: Number(metrics.violations24h ?? 0) || 0,
      openCampaigns: Number(metrics.openCampaigns ?? 0) || 0,
      overdueCampaigns: Number(metrics.overdueCampaigns ?? 0) || 0,
      payload: body && typeof body === "object" ? body : null,
    },
  });

  if ((Number(metrics.violations24h ?? 0) || 0) > 0) {
    await prisma.alert.create({
      data: {
        installationId: installation?.id ?? (await prisma.installation.upsert({
          where: { instanceId },
          update: {},
          create: { instanceId },
          select: { id: true },
        })).id,
        level: "warning",
        message: `SoD violations (24h): ${Number(metrics.violations24h ?? 0)}`,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, reportId: report.id });
}
