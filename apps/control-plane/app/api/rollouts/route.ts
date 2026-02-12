import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";
import { createBatch } from "../../lib/updates";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rollouts = await prisma.rollout.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      manifest: true,
      batches: {
        orderBy: { batchIndex: "desc" },
        include: {
          updateJobs: {
            orderBy: { updatedAt: "desc" },
            take: 30,
          },
        },
      },
    },
  });

  return NextResponse.json({ items: rollouts });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const manifestId = String(body.manifestId ?? body.manifest_id ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const batchSize = Number(body.batchSize ?? body.batch_size ?? 10);
  const strategy = String(body.strategy ?? "BATCH").toUpperCase();
  const canaryStepsRaw = body.canarySteps ?? body.canary_steps ?? [5, 25, 100];
  const canarySteps = Array.isArray(canaryStepsRaw)
    ? canaryStepsRaw.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0 && value <= 100)
    : [5, 25, 100];
  const canaryStepWaitSec = Number(body.canaryStepWaitSec ?? body.canary_step_wait_sec ?? 120);
  const sloP95Max = body.sloP95Max != null ? Number(body.sloP95Max) : null;
  const sloErrorRateMax = body.sloErrorRateMax != null ? Number(body.sloErrorRateMax) : null;
  const sloWebhookRetryRateMax =
    body.sloWebhookRetryRateMax != null ? Number(body.sloWebhookRetryRateMax) : null;
  const autoRollback = body.autoRollback == null ? true : Boolean(body.autoRollback);

  if (!manifestId || !channel || !Number.isFinite(batchSize) || batchSize <= 0) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (!["BATCH", "BLUE_GREEN_CANARY"].includes(strategy)) {
    return NextResponse.json({ error: "invalid strategy" }, { status: 400 });
  }
  if (!Number.isFinite(canaryStepWaitSec) || canaryStepWaitSec < 0) {
    return NextResponse.json({ error: "invalid canaryStepWaitSec" }, { status: 400 });
  }

  const manifest = await prisma.releaseManifest.findUnique({ where: { id: manifestId } });
  if (!manifest) {
    return NextResponse.json({ error: "manifest not found" }, { status: 404 });
  }

  const rollout = await prisma.rollout.create({
    data: {
      manifestId,
      channel,
      batchSize,
      strategy,
      canarySteps: canarySteps.length > 0 ? canarySteps : [5, 25, 100],
      canaryStepWaitSec,
      sloP95Max: Number.isFinite(Number(sloP95Max)) ? Number(sloP95Max) : null,
      sloErrorRateMax: Number.isFinite(Number(sloErrorRateMax)) ? Number(sloErrorRateMax) : null,
      sloWebhookRetryRateMax: Number.isFinite(Number(sloWebhookRetryRateMax))
        ? Number(sloWebhookRetryRateMax)
        : null,
      autoRollback,
      batchIndex: 0,
      status: "running",
    },
  });

  const { batch, created } = await createBatch(rollout.id, 0, batchSize, channel, manifestId);
  if (!batch) {
    await prisma.rollout.update({
      where: { id: rollout.id },
      data: { status: "completed" },
    });
    return NextResponse.json({ id: rollout.id, created: 0, status: "completed" });
  }

  return NextResponse.json({ id: rollout.id, batchId: batch.id, created });
}
