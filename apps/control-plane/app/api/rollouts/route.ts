import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";
import { createBatch } from "../../lib/updates";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const manifestId = String(body.manifestId ?? body.manifest_id ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const batchSize = Number(body.batchSize ?? body.batch_size ?? 10);

  if (!manifestId || !channel || !Number.isFinite(batchSize) || batchSize <= 0) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
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
