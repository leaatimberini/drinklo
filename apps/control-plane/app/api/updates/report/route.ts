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
  const canaryPercent =
    body.canary_percent != null && Number.isFinite(Number(body.canary_percent))
      ? Number(body.canary_percent)
      : null;
  const metricP95Ms =
    body.metric_p95_ms != null && Number.isFinite(Number(body.metric_p95_ms))
      ? Number(body.metric_p95_ms)
      : null;
  const metricErrorRate =
    body.metric_error_rate != null && Number.isFinite(Number(body.metric_error_rate))
      ? Number(body.metric_error_rate)
      : null;
  const metricWebhookRetryRate =
    body.metric_webhook_retry_rate != null &&
    Number.isFinite(Number(body.metric_webhook_retry_rate))
      ? Number(body.metric_webhook_retry_rate)
      : null;
  const meta = body.meta && typeof body.meta === "object" ? body.meta : null;

  if (!jobId || !status) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const job = await prisma.updateJob.findUnique({
    where: { id: jobId },
    include: { installation: true },
  });
  if (!job || job.installation.instanceId !== instanceId) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  const finished =
    status === "succeeded" || status === "failed" || status === "rolled_back";

  await prisma.updateJob.update({
    where: { id: jobId },
    data: {
      status,
      step,
      error,
      canaryPercent,
      metricP95Ms,
      metricErrorRate,
      metricWebhookRetryRate,
      meta,
      finishedAt: finished ? new Date() : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
