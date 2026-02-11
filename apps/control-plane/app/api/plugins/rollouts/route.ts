import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { createPluginBatch } from "../../../lib/plugin-rollout";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const pluginName = String(body.pluginName ?? body.plugin_name ?? "").trim();
  const version = String(body.version ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const action = String(body.action ?? "install");
  const batchSize = Number(body.batchSize ?? body.batch_size ?? 10);

  if (!pluginName || !version || !channel || !Number.isFinite(batchSize) || batchSize <= 0) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const rollout = await prisma.pluginRollout.create({
    data: {
      pluginName,
      version,
      channel,
      batchSize,
      batchIndex: 0,
      status: "running",
    },
  });

  const { batch, created } = await createPluginBatch(
    rollout.id,
    0,
    batchSize,
    channel,
    pluginName,
    version,
    action,
  );

  if (!batch) {
    await prisma.pluginRollout.update({
      where: { id: rollout.id },
      data: { status: "completed" },
    });
    return NextResponse.json({ id: rollout.id, created: 0, status: "completed" });
  }

  return NextResponse.json({ id: rollout.id, batchId: batch.id, created });
}
