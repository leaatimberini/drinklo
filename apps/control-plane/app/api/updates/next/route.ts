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

  const installation = await prisma.installation.findUnique({
    where: { instanceId },
  });
  if (!installation) {
    return NextResponse.json({ error: "unknown instance" }, { status: 404 });
  }

  const job = await prisma.updateJob.findFirst({
    where: { installationId: installation.id, status: "pending" },
    include: {
      manifest: true,
      batch: {
        include: {
          rollout: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!job) {
    return new NextResponse(null, { status: 204 });
  }

  await prisma.updateJob.update({
    where: { id: job.id },
    data: { status: "in_progress", startedAt: new Date(), step: "accepted" },
  });

  return NextResponse.json({
    job_id: job.id,
    manifest: {
      version: job.manifest.version,
      sha: job.manifest.sha,
      channel: job.manifest.channel,
      migrations_required: job.manifest.migrationsRequired,
      breaking_changes: job.manifest.breakingChanges,
      released_at: job.manifest.releasedAt.toISOString(),
      signature: job.manifest.signature,
    },
    rollout: {
      strategy: job.batch.rollout.strategy,
      canary_steps: job.batch.rollout.canarySteps,
      canary_step_wait_sec: job.batch.rollout.canaryStepWaitSec,
      slo_p95_max: job.batch.rollout.sloP95Max,
      slo_error_rate_max: job.batch.rollout.sloErrorRateMax,
      slo_webhook_retry_rate_max: job.batch.rollout.sloWebhookRetryRateMax,
      auto_rollback: job.batch.rollout.autoRollback,
    },
  });
}
