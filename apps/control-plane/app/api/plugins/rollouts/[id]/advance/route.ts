import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { isAdminRequest } from "../../../../../lib/admin-auth";
import { createPluginBatch } from "../../../../../lib/plugin-rollout";

export async function POST(req: NextRequest, ctx: any) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = ctx?.params?.id as string;
  const rollout = await prisma.pluginRollout.findUnique({
    where: { id },
  });
  if (!rollout) {
    return NextResponse.json({ error: "rollout not found" }, { status: 404 });
  }
  if (rollout.status !== "running") {
    return NextResponse.json({ error: "rollout not running" }, { status: 409 });
  }

  const currentBatch = await prisma.pluginRolloutBatch.findFirst({
    where: { rolloutId: rollout.id, batchIndex: rollout.batchIndex },
  });
  if (currentBatch) {
    const pending = await prisma.pluginJob.count({
      where: { batchId: currentBatch.id, status: { in: ["pending", "in_progress"] } },
    });
    if (pending > 0) {
      return NextResponse.json({ error: "batch in progress" }, { status: 409 });
    }
    await prisma.pluginRolloutBatch.update({
      where: { id: currentBatch.id },
      data: { status: "completed", finishedAt: new Date() },
    });
  }

  const nextIndex = rollout.batchIndex + 1;
  const { batch, created } = await createPluginBatch(
    rollout.id,
    nextIndex,
    rollout.batchSize,
    rollout.channel,
    rollout.pluginName,
    rollout.version,
    "install",
  );

  if (!batch) {
    await prisma.pluginRollout.update({
      where: { id: rollout.id },
      data: { status: "completed" },
    });
    return NextResponse.json({ id: rollout.id, status: "completed" });
  }

  await prisma.pluginRollout.update({
    where: { id: rollout.id },
    data: { batchIndex: nextIndex },
  });

  return NextResponse.json({ id: rollout.id, batchId: batch.id, created });
}
