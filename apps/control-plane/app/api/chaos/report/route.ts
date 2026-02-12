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
  const environment = String(body.environment ?? "staging").trim();
  const scenario = String(body.scenario ?? "unknown").trim();
  const status = String(body.status ?? "unknown").trim();
  const sloP95Ms = body.sloP95Ms != null ? Number(body.sloP95Ms) : null;
  const sloErrorRate = body.sloErrorRate != null ? Number(body.sloErrorRate) : null;
  const sloWebhookRetryRate = body.sloWebhookRetryRate != null ? Number(body.sloWebhookRetryRate) : null;
  const durationMs = body.durationMs != null ? Number(body.durationMs) : null;
  const details = body.details && typeof body.details === "object" ? body.details : null;

  if (!instanceId || !scenario || !status) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({ where: { instanceId }, select: { id: true } });

  const run = await prisma.chaosRun.create({
    data: {
      installationId: installation?.id ?? null,
      instanceId,
      environment,
      scenario,
      status,
      sloP95Ms,
      sloErrorRate,
      sloWebhookRetryRate,
      durationMs,
      details,
    },
  });

  return NextResponse.json({ ok: true, id: run.id });
}
