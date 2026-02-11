import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import crypto from "node:crypto";

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

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-agent-signature") ?? "";
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);
  const instanceId = body.instance_id;

  if (!signature || !instanceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secretMap = process.env.CONTROL_PLANE_AGENT_SECRETS;
  const globalSecret = process.env.CONTROL_PLANE_AGENT_TOKEN ?? "";
  let secret = globalSecret;
  if (secretMap) {
    try {
      const parsed = JSON.parse(secretMap) as Record<string, string>;
      secret = parsed[instanceId] ?? globalSecret;
    } catch {
      secret = globalSecret;
    }
  }

  if (!secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!instanceId) {
    return NextResponse.json({ error: "instance_id required" }, { status: 400 });
  }

  const now = new Date();
  const installation = await prisma.installation.upsert({
    where: { instanceId },
    update: {
      domain: body.domain ?? undefined,
      clientName: body.client ?? undefined,
      version: body.version ?? undefined,
      releaseChannel: body.release_channel ?? undefined,
      healthStatus: body.health ?? undefined,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      backupStatus: body.backup_status ?? undefined,
      lastBackupAt: body.last_backup_at ? new Date(body.last_backup_at) : undefined,
      sloP95Ms: body.slo_p95_ms ?? undefined,
      sloErrorRate: body.slo_error_rate ?? undefined,
      sloWebhookRetryRate: body.slo_webhook_retry_rate ?? undefined,
      sloUpdatedAt: body.slo_updated_at ? new Date(body.slo_updated_at) : undefined,
      eventsTotal1h: body.events_total_1h ?? undefined,
      eventsFailed1h: body.events_failed_1h ?? undefined,
      eventsAvgLagMs: body.events_avg_lag_ms ?? undefined,
    },
    create: {
      instanceId,
      domain: body.domain ?? null,
      clientName: body.client ?? null,
      version: body.version ?? null,
      releaseChannel: body.release_channel ?? null,
      healthStatus: body.health ?? null,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      backupStatus: body.backup_status ?? null,
      lastBackupAt: body.last_backup_at ? new Date(body.last_backup_at) : null,
      sloP95Ms: body.slo_p95_ms ?? null,
      sloErrorRate: body.slo_error_rate ?? null,
      sloWebhookRetryRate: body.slo_webhook_retry_rate ?? null,
      sloUpdatedAt: body.slo_updated_at ? new Date(body.slo_updated_at) : null,
      eventsTotal1h: body.events_total_1h ?? null,
      eventsFailed1h: body.events_failed_1h ?? null,
      eventsAvgLagMs: body.events_avg_lag_ms ?? null,
    },
  });

  if (body.backup_id || body.backup_checksum) {
    const latest = await prisma.backupRecord.findFirst({
      where: { installationId: installation.id },
      orderBy: { createdAt: "desc" },
    });
    const checksum = body.backup_checksum ?? null;
    const shouldInsert = !latest || (checksum && latest.checksum !== checksum);
    if (shouldInsert) {
      await prisma.backupRecord.create({
        data: {
          installationId: installation.id,
          instanceId,
          backupId: body.backup_id ?? null,
          sizeBytes: body.backup_size_bytes ?? null,
          checksum,
          bucket: body.backup_bucket ?? null,
          path: body.backup_path ?? null,
          meta: {
            lastBackupAt: body.last_backup_at ?? null,
          },
        },
      });
    }
  }

  const alerts = Array.isArray(body.alerts) ? body.alerts : [];
  for (const alert of alerts) {
    await prisma.alert.create({
      data: {
        installationId: installation.id,
        level: alert.level ?? "info",
        message: alert.message ?? "",
      },
    });
  }

  const jobs = Array.isArray(body.job_failures) ? body.job_failures : [];
  for (const job of jobs) {
    await prisma.jobFailure.create({
      data: {
        installationId: installation.id,
        message: job.message ?? "",
        queue: job.queue ?? null,
      },
    });
  }

  const p95Max = Number(process.env.SLO_P95_MS_MAX ?? 0);
  const errorRateMax = Number(process.env.SLO_ERROR_RATE_MAX ?? 0);
  const webhookRetryMax = Number(process.env.SLO_WEBHOOK_RETRY_RATE_MAX ?? 0);

  const sloAlerts: Array<{ key: string; message: string }> = [];
  if (p95Max > 0 && Number(body.slo_p95_ms) > p95Max) {
    sloAlerts.push({
      key: "slo_p95_ms",
      message: `SLO breach: p95 ${body.slo_p95_ms}ms > ${p95Max}ms`,
    });
  }
  if (errorRateMax > 0 && Number(body.slo_error_rate) > errorRateMax) {
    sloAlerts.push({
      key: "slo_error_rate",
      message: `SLO breach: error rate ${body.slo_error_rate} > ${errorRateMax}`,
    });
  }
  if (webhookRetryMax > 0 && Number(body.slo_webhook_retry_rate) > webhookRetryMax) {
    sloAlerts.push({
      key: "slo_webhook_retry_rate",
      message: `SLO breach: webhook retry rate ${body.slo_webhook_retry_rate} > ${webhookRetryMax}`,
    });
  }

  for (const alert of sloAlerts) {
    const recent = await prisma.alert.findFirst({
      where: {
        installationId: installation.id,
        message: alert.message,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (!recent) {
      await prisma.alert.create({
        data: {
          installationId: installation.id,
          level: "error",
          message: alert.message,
        },
      });
      await notifyProviderAlert(alert.message, {
        instanceId,
        installationId: installation.id,
        type: alert.key,
      });
    }
  }

  const secretsExpired = Number(body.secrets_expired ?? 0);
  const secretsUnverified = Number(body.secrets_unverified ?? 0);
  if ((secretsExpired > 0 || secretsUnverified > 0) && Number.isFinite(secretsExpired)) {
    const message = `Secrets expired: ${secretsExpired}, unverified: ${secretsUnverified}`;
    const recent = await prisma.alert.findFirst({
      where: {
        installationId: installation.id,
        message,
        createdAt: {
          gt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
      },
    });
    if (!recent) {
      await prisma.alert.create({
        data: {
          installationId: installation.id,
          level: "warning",
          message,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
