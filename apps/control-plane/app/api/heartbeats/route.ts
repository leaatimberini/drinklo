import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import crypto from "node:crypto";
import { bigIntDelta, estimateMonthlyCost, toBigIntOrNull } from "../../lib/finops";

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
  const prevInstallation = await prisma.installation.findUnique({
    where: { instanceId },
    select: {
      id: true,
      networkRxBytes: true,
      networkTxBytes: true,
      dbSizeBytes: true,
      storageSizeBytes: true,
    },
  });
  const cpuUsagePct = body.cpu_usage_pct != null ? Number(body.cpu_usage_pct) : null;
  const memoryUsedBytes = toBigIntOrNull(body.memory_used_bytes);
  const memoryTotalBytes = toBigIntOrNull(body.memory_total_bytes);
  const diskUsedBytes = toBigIntOrNull(body.disk_used_bytes);
  const diskTotalBytes = toBigIntOrNull(body.disk_total_bytes);
  const networkRxBytes = toBigIntOrNull(body.network_rx_bytes);
  const networkTxBytes = toBigIntOrNull(body.network_tx_bytes);
  const dbSizeBytes = toBigIntOrNull(body.db_size_bytes);
  const storageSizeBytes = toBigIntOrNull(body.storage_size_bytes);
  const jobsProcessed1h = body.jobs_processed_1h != null ? Number(body.jobs_processed_1h) : null;
  const jobsPending = body.jobs_pending != null ? Number(body.jobs_pending) : null;
  const networkRxDelta = bigIntDelta(networkRxBytes, prevInstallation?.networkRxBytes ?? null);
  const networkTxDelta = bigIntDelta(networkTxBytes, prevInstallation?.networkTxBytes ?? null);
  const estimatedCost = await estimateMonthlyCost({
    cpuUsagePct: cpuUsagePct ?? undefined,
    memoryUsedBytes,
    diskUsedBytes,
    networkRxDeltaBytes: networkRxDelta,
    networkTxDeltaBytes: networkTxDelta,
    dbSizeBytes,
    storageSizeBytes,
    jobsProcessed1h: jobsProcessed1h ?? undefined,
  });

  const installation = await prisma.installation.upsert({
    where: { instanceId },
    update: {
      domain: body.domain ?? undefined,
      clientName: body.client ?? undefined,
      version: body.version ?? undefined,
      releaseChannel: body.release_channel ?? undefined,
      healthStatus: body.health ?? undefined,
      searchOk: typeof body.search_ok === "boolean" ? body.search_ok : undefined,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      backupStatus: body.backup_status ?? undefined,
      lastBackupAt: body.last_backup_at ? new Date(body.last_backup_at) : undefined,
      sloP95Ms: body.slo_p95_ms ?? undefined,
      sloErrorRate: body.slo_error_rate ?? undefined,
      sloWebhookRetryRate: body.slo_webhook_retry_rate ?? undefined,
      sloUpdatedAt: body.slo_updated_at ? new Date(body.slo_updated_at) : undefined,
      cpuUsagePct: cpuUsagePct ?? undefined,
      memoryUsedBytes: memoryUsedBytes ?? undefined,
      memoryTotalBytes: memoryTotalBytes ?? undefined,
      diskUsedBytes: diskUsedBytes ?? undefined,
      diskTotalBytes: diskTotalBytes ?? undefined,
      networkRxBytes: networkRxBytes ?? undefined,
      networkTxBytes: networkTxBytes ?? undefined,
      dbSizeBytes: dbSizeBytes ?? undefined,
      storageSizeBytes: storageSizeBytes ?? undefined,
      jobsProcessed1h: jobsProcessed1h ?? undefined,
      jobsPending: jobsPending ?? undefined,
      estimatedMonthlyCostUsd: estimatedCost.totalUsd,
      finopsUpdatedAt: now,
      eventsTotal1h: body.events_total_1h ?? undefined,
      eventsFailed1h: body.events_failed_1h ?? undefined,
      eventsAvgLagMs: body.events_avg_lag_ms ?? undefined,
      iamSsoEnabled: body.iam_sso_enabled ?? undefined,
      iamMfaEnforced: body.iam_mfa_enforced ?? undefined,
      iamScimEnabled: body.iam_scim_enabled ?? undefined,
      iamLastSyncAt: body.iam_last_sync_at ? new Date(body.iam_last_sync_at) : undefined,
    },
    create: {
      instanceId,
      domain: body.domain ?? null,
      clientName: body.client ?? null,
      version: body.version ?? null,
      releaseChannel: body.release_channel ?? null,
      healthStatus: body.health ?? null,
      searchOk: typeof body.search_ok === "boolean" ? body.search_ok : null,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      backupStatus: body.backup_status ?? null,
      lastBackupAt: body.last_backup_at ? new Date(body.last_backup_at) : null,
      sloP95Ms: body.slo_p95_ms ?? null,
      sloErrorRate: body.slo_error_rate ?? null,
      sloWebhookRetryRate: body.slo_webhook_retry_rate ?? null,
      sloUpdatedAt: body.slo_updated_at ? new Date(body.slo_updated_at) : null,
      cpuUsagePct: cpuUsagePct,
      memoryUsedBytes,
      memoryTotalBytes,
      diskUsedBytes,
      diskTotalBytes,
      networkRxBytes,
      networkTxBytes,
      dbSizeBytes,
      storageSizeBytes,
      jobsProcessed1h,
      jobsPending,
      estimatedMonthlyCostUsd: estimatedCost.totalUsd,
      finopsUpdatedAt: now,
      eventsTotal1h: body.events_total_1h ?? null,
      eventsFailed1h: body.events_failed_1h ?? null,
      eventsAvgLagMs: body.events_avg_lag_ms ?? null,
      iamSsoEnabled: body.iam_sso_enabled ?? null,
      iamMfaEnforced: body.iam_mfa_enforced ?? null,
      iamScimEnabled: body.iam_scim_enabled ?? null,
      iamLastSyncAt: body.iam_last_sync_at ? new Date(body.iam_last_sync_at) : null,
    },
  });

  await prisma.finOpsSnapshot.create({
    data: {
      installationId: installation.id,
      recordedAt: now,
      cpuUsagePct: cpuUsagePct ?? null,
      memoryUsedBytes,
      memoryTotalBytes,
      diskUsedBytes,
      diskTotalBytes,
      networkRxBytes,
      networkTxBytes,
      dbSizeBytes,
      storageSizeBytes,
      jobsFailed: Number(body.jobs_failed ?? 0),
      jobsProcessed1h,
      jobsPending,
      estimatedMonthlyCostUsd: estimatedCost.totalUsd,
      meta: {
        networkRxDeltaBytes: networkRxDelta?.toString() ?? null,
        networkTxDeltaBytes: networkTxDelta?.toString() ?? null,
        costBreakdown: estimatedCost.byResource,
      },
    },
  });

  await prisma.finOpsCostRecord.create({
    data: {
      installationId: installation.id,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: now,
      estimatedCostUsd: estimatedCost.totalUsd,
      breakdown: estimatedCost.byResource,
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

  const dbGrowthThresholdPct = Number(process.env.FINOPS_DB_GROWTH_ALERT_PCT ?? 25);
  const storageGrowthThresholdPct = Number(process.env.FINOPS_STORAGE_GROWTH_ALERT_PCT ?? 25);
  const networkRunawayGbPerHour = Number(process.env.FINOPS_NETWORK_RUNAWAY_GB_PER_HOUR ?? 5);
  const dbBloatRatio = Number(process.env.FINOPS_DB_BLOAT_RATIO_TO_DISK_USED ?? 0.75);

  const previousDbSize = prevInstallation?.dbSizeBytes ? Number(prevInstallation.dbSizeBytes) : null;
  const previousStorageSize = prevInstallation?.storageSizeBytes ? Number(prevInstallation.storageSizeBytes) : null;
  const currentDbSize = dbSizeBytes != null ? Number(dbSizeBytes) : null;
  const currentStorageSize = storageSizeBytes != null ? Number(storageSizeBytes) : null;
  const dbGrowthPct =
    previousDbSize && currentDbSize ? ((currentDbSize - previousDbSize) / previousDbSize) * 100 : null;
  const storageGrowthPct =
    previousStorageSize && currentStorageSize
      ? ((currentStorageSize - previousStorageSize) / previousStorageSize) * 100
      : null;
  const networkDeltaGb =
    Number((networkRxDelta ?? 0n) + (networkTxDelta ?? 0n)) / (1024 * 1024 * 1024);
  const diskUsed = diskUsedBytes != null ? Number(diskUsedBytes) : null;
  const dbBloatObserved = currentDbSize && diskUsed ? currentDbSize / Math.max(1, diskUsed) : 0;

  const finopsAlerts: Array<{ level: "warning" | "error"; message: string; type: string }> = [];
  if (dbGrowthPct != null && dbGrowthThresholdPct > 0 && dbGrowthPct > dbGrowthThresholdPct) {
    finopsAlerts.push({
      level: "warning",
      type: "finops_db_growth",
      message: `FinOps anomaly: DB growth ${dbGrowthPct.toFixed(1)}% (threshold ${dbGrowthThresholdPct}%)`,
    });
  }
  if (storageGrowthPct != null && storageGrowthThresholdPct > 0 && storageGrowthPct > storageGrowthThresholdPct) {
    finopsAlerts.push({
      level: "warning",
      type: "finops_storage_runaway",
      message: `FinOps anomaly: storage growth ${storageGrowthPct.toFixed(1)}% (threshold ${storageGrowthThresholdPct}%)`,
    });
  }
  if (networkRunawayGbPerHour > 0 && networkDeltaGb > networkRunawayGbPerHour) {
    finopsAlerts.push({
      level: "warning",
      type: "finops_network_runaway",
      message: `FinOps anomaly: network ${networkDeltaGb.toFixed(2)}GB/h (threshold ${networkRunawayGbPerHour}GB/h)`,
    });
  }
  if (dbBloatRatio > 0 && dbBloatObserved > dbBloatRatio) {
    finopsAlerts.push({
      level: "error",
      type: "finops_db_bloat",
      message: `FinOps anomaly: DB bloat ratio ${(dbBloatObserved * 100).toFixed(1)}% of used disk`,
    });
  }
  for (const alert of finopsAlerts) {
    const recent = await prisma.alert.findFirst({
      where: {
        installationId: installation.id,
        message: alert.message,
        createdAt: { gt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      },
    });
    if (recent) continue;
    await prisma.alert.create({
      data: {
        installationId: installation.id,
        level: alert.level,
        message: alert.message,
      },
    });
    await notifyProviderAlert(alert.message, {
      instanceId,
      installationId: installation.id,
      type: alert.type,
      estimatedMonthlyCostUsd: estimatedCost.totalUsd,
    });
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
