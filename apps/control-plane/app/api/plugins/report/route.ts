import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { verifyAgentSignature } from "../../../lib/agent-auth";

export async function POST(req: Request) {
  const signature = req.headers.get("x-agent-signature") ?? "";
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);
  const instanceId = body.instance_id;

  if (!instanceId || !signature) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!verifyAgentSignature(rawBody, signature, instanceId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobId = body.job_id;
  const status = String(body.status ?? "").trim();
  const step = body.step ? String(body.step) : null;
  const error = body.error ? String(body.error) : null;
  const durationMs = body.duration_ms ? Number(body.duration_ms) : null;

  if (!jobId || !status) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const job = await prisma.pluginJob.findUnique({ where: { id: jobId } });
  if (!job || job.instanceId !== instanceId) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  const finished = status === "succeeded" || status === "failed" || status === "rolled_back";
  await prisma.pluginJob.update({
    where: { id: jobId },
    data: {
      status,
      step,
      error,
      durationMs: durationMs ?? undefined,
      finishedAt: finished ? new Date() : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
