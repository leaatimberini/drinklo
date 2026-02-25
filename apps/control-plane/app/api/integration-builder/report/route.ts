import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { computeShardKey } from "../../../lib/fleet-scaling";

function isIngestAuthorized(req: Request) {
  const expected = process.env.CONTROL_PLANE_INGEST_TOKEN ?? "";
  if (!expected) return false;
  return (req.headers.get("x-cp-ingest-token") ?? "") === expected;
}

export async function POST(req: Request) {
  if (!isIngestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const instanceId = String(body.instanceId ?? "").trim();
  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }
  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
  if (Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: "invalid capturedAt" }, { status: 400 });
  }

  let installation = await prisma.installation.findUnique({ where: { instanceId }, select: { id: true } });
  if (!installation) {
    installation = await prisma.installation.create({ data: { instanceId }, select: { id: true } });
  }

  const report = await prisma.integrationBuilderReport.create({
    data: {
      installationId: installation.id,
      instanceId,
      shardKey: computeShardKey(instanceId),
      companyId: body.companyId ? String(body.companyId) : null,
      capturedAt,
      connectorsTotal: Number(body.connectorsTotal ?? 0) || 0,
      connectorsActive: Number(body.connectorsActive ?? 0) || 0,
      deliveriesSuccess24h: Number(body.deliveriesSuccess24h ?? 0) || 0,
      deliveriesFailed24h: Number(body.deliveriesFailed24h ?? 0) || 0,
      dlqOpen: Number(body.dlqOpen ?? 0) || 0,
      payload: body && typeof body === "object" ? body : null,
    },
  });

  if ((Number(body.dlqOpen ?? 0) || 0) > 0) {
    await prisma.alert.create({
      data: {
        installationId: installation.id,
        level: "warning",
        message: `Integration Builder DLQ open: ${Number(body.dlqOpen ?? 0)}`,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, reportId: report.id });
}
