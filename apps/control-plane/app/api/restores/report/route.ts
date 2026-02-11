import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { verifyAgentSignature } from "../../../lib/agent-auth";

async function notifyProviderAlert(message: string, payload: Record<string, any>) {
  const webhookUrl = process.env.CONTROL_PLANE_ALERT_WEBHOOK_URL ?? "";
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CONTROL_PLANE_ALERT_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.CONTROL_PLANE_ALERT_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ message, ...payload }),
    });
  } catch {
    // best-effort
  }
}

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

  const restoreId = body.restore_id;
  const status = String(body.status ?? "").trim();
  const message = body.message ? String(body.message) : null;

  if (!restoreId || !status) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const restore = await prisma.restoreVerification.findUnique({
    where: { id: restoreId },
  });
  if (!restore || restore.instanceId !== instanceId) {
    return NextResponse.json({ error: "restore not found" }, { status: 404 });
  }

  const finished =
    status === "verified" || status === "failed" || status === "skipped";

  await prisma.restoreVerification.update({
    where: { id: restoreId },
    data: {
      status,
      message,
      startedAt: body.started_at ? new Date(body.started_at) : undefined,
      finishedAt: finished ? new Date() : undefined,
      meta: body.meta ?? undefined,
    },
  });

  if (status === "failed") {
    const alertMessage = `Restore verification failed: ${instanceId}`;
    await prisma.alert.create({
      data: {
        installationId: restore.installationId,
        level: "error",
        message: alertMessage,
      },
    });
    await notifyProviderAlert(alertMessage, { instanceId, restoreId });
  }

  return NextResponse.json({ ok: true });
}
