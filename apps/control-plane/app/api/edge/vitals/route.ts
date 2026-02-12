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
  const name = String(body.name ?? "").trim();
  const value = Number(body.value);
  const rating = body.rating ? String(body.rating) : null;
  const path = body.path ? String(body.path) : null;
  const metricId = body.id ? String(body.id) : null;
  const userAgent = body.userAgent ? String(body.userAgent) : null;
  const ip = body.ip ? String(body.ip) : null;
  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();

  if (!instanceId || !name || !Number.isFinite(value) || Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({ where: { instanceId }, select: { id: true } });

  await prisma.webVitalSample.create({
    data: {
      installationId: installation?.id ?? null,
      instanceId,
      name,
      value,
      rating,
      path,
      metricId,
      userAgent,
      ip,
      capturedAt,
    },
  });

  return NextResponse.json({ ok: true });
}
