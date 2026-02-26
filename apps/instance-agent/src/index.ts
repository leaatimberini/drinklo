import express from "express";
import { signPayload } from "./signing";
import {
  validateHeartbeat,
  type HeartbeatPayload,
  type RegionalHealthSample,
} from "./payload";
import { startUpdateLoop } from "./update";
import { startPluginLoop } from "./plugin-update";
import { parseMetricsSummary } from "./metrics";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import { setInterval } from "node:timers";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { Client as PgClient } from "pg";

const INSTANCE_ID = process.env.INSTANCE_ID ?? "";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";
const HEARTBEAT_INTERVAL_MIN = Number(process.env.HEARTBEAT_INTERVAL_MIN ?? 5);
const DOMAIN = process.env.INSTANCE_DOMAIN ?? undefined;
const CLIENT = process.env.INSTANCE_CLIENT ?? undefined;
const VERSION = process.env.INSTANCE_VERSION ?? undefined;
const RELEASE_CHANNEL = process.env.RELEASE_CHANNEL ?? undefined;
const LOCAL_PORT = Number(process.env.AGENT_PORT ?? 4010);
const LOCAL_TOKEN = process.env.AGENT_LOCAL_TOKEN ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";
const REDIS_URL = process.env.REDIS_URL ?? "";
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT ?? process.env.STORAGE_PUBLIC_URL ?? "";
const MEILI_HOST = process.env.MEILI_HOST ?? "";
const OPS_URL = process.env.AGENT_OPS_URL ?? "";
const OPS_TOKEN = process.env.AGENT_OPS_TOKEN ?? "";
const BACKUP_META_PATH = process.env.BACKUP_META_PATH ?? "";
const METRICS_URL = process.env.AGENT_METRICS_URL ?? "http://api:3001/metrics";
const EVENTS_STATS_URL = process.env.AGENT_EVENTS_STATS_URL ?? "http://api:3001/admin/events/stats";
const EVENTS_INGEST_URL = process.env.AGENT_EVENTS_URL ?? "http://api:3001/events/ingest";
const FEATURE_USAGE_URL =
  process.env.AGENT_FEATURE_USAGE_URL ?? "http://api:3001/admin/events/feature-usage";
const IAM_SSO_ENABLED = String(process.env.IAM_SSO_ENABLED ?? "false").toLowerCase() === "true";
const IAM_MFA_ENFORCED = String(process.env.IAM_MFA_ENFORCED ?? "false").toLowerCase() === "true";
const IAM_SCIM_ENABLED = String(process.env.IAM_SCIM_ENABLED ?? "false").toLowerCase() === "true";
const STORAGE_DATA_PATH = process.env.STORAGE_DATA_PATH ?? "";
const SYSTEM_ROOT_PATH = process.env.AGENT_SYSTEM_ROOT_PATH ?? path.parse(process.cwd()).root;
const AGENT_DB_SIZE_CMD = process.env.AGENT_DB_SIZE_CMD ?? "";
const AGENT_STORAGE_SIZE_CMD = process.env.AGENT_STORAGE_SIZE_CMD ?? "";
const AGENT_NETWORK_STATS_CMD = process.env.AGENT_NETWORK_STATS_CMD ?? "";
const PRIMARY_REGION = process.env.PRIMARY_REGION ?? "";
const REGIONAL_HEALTH_ENDPOINTS = process.env.REGIONAL_HEALTH_ENDPOINTS ?? "";

const exec = promisify(execCb);

const startTime = Date.now();
let featureUsageCursor: Date | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseHostPort(url: string, defaultPort: number) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: Number(parsed.port || defaultPort) };
  } catch {
    return { host: "", port: defaultPort };
  }
}

async function tcpCheck(url: string, defaultPort: number): Promise<boolean> {
  if (!url) return false;
  const { host, port } = parseHostPort(url, defaultPort);
  if (!host) return false;

  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 2000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function fetchJson(url: string, token?: string) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

async function fetchText(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  return res.text();
}

function parseRegionalEndpoints() {
  if (!REGIONAL_HEALTH_ENDPOINTS) return [] as Array<{ region: string; endpoint: string }>;
  try {
    const parsed = JSON.parse(REGIONAL_HEALTH_ENDPOINTS) as Array<{ region?: string; endpoint?: string }>;
    return parsed
      .map((item) => ({ region: item.region?.trim() ?? "", endpoint: item.endpoint?.trim() ?? "" }))
      .filter((item) => item.region && item.endpoint);
  } catch {
    return [];
  }
}

async function probeRegionalHealth(): Promise<RegionalHealthSample[]> {
  const endpoints = parseRegionalEndpoints();
  const checkedAt = new Date().toISOString();
  if (endpoints.length === 0) return [];

  const probes = endpoints.map(async (target) => {
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(target.endpoint, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      return {
        region: target.region,
        role: target.region === PRIMARY_REGION ? "primary" : "secondary",
        ok: res.ok,
        latency_ms: Date.now() - started,
        checked_at: checkedAt,
        endpoint: target.endpoint,
      } as RegionalHealthSample;
    } catch {
      return {
        region: target.region,
        role: target.region === PRIMARY_REGION ? "primary" : "secondary",
        ok: false,
        checked_at: checkedAt,
        endpoint: target.endpoint,
      } as RegionalHealthSample;
    }
  });

  return Promise.all(probes);
}

async function dirSizeBytes(targetPath: string): Promise<number | undefined> {
  if (!targetPath) return undefined;
  if (!fs.existsSync(targetPath)) return undefined;
  const root = await fs.promises.stat(targetPath);
  if (!root.isDirectory()) {
    return root.size;
  }

  let total = 0;
  const stack = [targetPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        try {
          const file = await fs.promises.stat(full);
          total += file.size;
        } catch {
          // ignore unreadable files
        }
      }
    }
  }
  return total;
}

function diskUsage(targetPath: string) {
  try {
    const stats = fs.statfsSync(targetPath);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    return { used: total - free, total };
  } catch {
    return { used: undefined, total: undefined };
  }
}

function linuxNetworkBytes(): { rx?: number; tx?: number } {
  try {
    if (process.platform !== "linux" || !fs.existsSync("/proc/net/dev")) {
      return {};
    }
    const raw = fs.readFileSync("/proc/net/dev", "utf8");
    const lines = raw.split("\n").slice(2);
    let rx = 0;
    let tx = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.replace(":", " ").trim().split(/\s+/);
      if (parts.length < 10) continue;
      const iface = parts[0];
      if (iface === "lo") continue;
      const ifaceRx = Number(parts[1]);
      const ifaceTx = Number(parts[9]);
      if (Number.isFinite(ifaceRx)) rx += ifaceRx;
      if (Number.isFinite(ifaceTx)) tx += ifaceTx;
    }
    return {
      rx: rx > 0 ? rx : undefined,
      tx: tx > 0 ? tx : undefined,
    };
  } catch {
    return {};
  }
}

async function runNumericCommand(command: string) {
  if (!command) return undefined;
  try {
    const { stdout } = await exec(command, { timeout: 7000 });
    const value = Number(String(stdout).trim());
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function networkBytes() {
  const commandResult = await runNumericCommand(AGENT_NETWORK_STATS_CMD);
  if (commandResult != null) {
    return { rx: commandResult, tx: undefined };
  }
  return linuxNetworkBytes();
}

async function dbSizeBytes() {
  const viaCommand = await runNumericCommand(AGENT_DB_SIZE_CMD);
  if (viaCommand != null) return viaCommand;
  if (!DB_URL) return undefined;

  const client = new PgClient({ connectionString: DB_URL });
  try {
    await client.connect();
    const result = await client.query<{ size: string | number }>(
      "select pg_database_size(current_database())::bigint as size",
    );
    const raw = result.rows[0]?.size;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function storageSizeBytes() {
  const viaCommand = await runNumericCommand(AGENT_STORAGE_SIZE_CMD);
  if (viaCommand != null) return viaCommand;
  return dirSizeBytes(STORAGE_DATA_PATH);
}

async function collectHeartbeat(): Promise<HeartbeatPayload> {
  const db_ok = await tcpCheck(DB_URL, 5432);
  const redis_ok = await tcpCheck(REDIS_URL, 6379);
  const storage_ok = STORAGE_ENDPOINT ? await tcpCheck(STORAGE_ENDPOINT, 9000) : true;
  const search_ok = MEILI_HOST ? await tcpCheck(MEILI_HOST, 7700) : true;

  let jobs_failed = 0;
  let jobs_processed_1h = 0;
  let jobs_pending = 0;
  let secrets_expired = 0;
  let secrets_unverified = 0;
  if (OPS_URL && OPS_TOKEN) {
    try {
      const ops = await fetchJson(OPS_URL, OPS_TOKEN);
      jobs_failed = ops.jobFailures?.length ?? 0;
      jobs_processed_1h = Number(ops.jobsProcessed1h ?? 0);
      jobs_pending = Number(ops.jobsPending ?? 0);
      secrets_expired = ops.secrets?.expired ?? 0;
      secrets_unverified = ops.secrets?.unverified ?? 0;
    } catch {
      jobs_failed = 0;
    }
  }

  let last_backup_at: string | null = null;
  let backup_id: string | undefined;
  let backup_size_bytes: number | undefined;
  let backup_checksum: string | undefined;
  let backup_bucket: string | undefined;
  let backup_path: string | undefined;
  if (BACKUP_META_PATH && fs.existsSync(BACKUP_META_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(BACKUP_META_PATH, "utf8"));
      last_backup_at = raw.lastBackupAt ?? null;
      backup_id = raw.backupId ?? raw.id ?? undefined;
      backup_size_bytes = raw.sizeBytes ?? undefined;
      backup_checksum = raw.checksum ?? undefined;
      backup_bucket = raw.bucket ?? undefined;
      backup_path = raw.path ?? undefined;
    } catch {
      last_backup_at = null;
    }
  }

  let slo_p95_ms: number | undefined;
  let slo_error_rate: number | undefined;
  let slo_webhook_retry_rate: number | undefined;
  let metric_jobs_processed_1h: number | undefined;
  let metric_jobs_pending: number | undefined;
  try {
    const metrics = await fetchText(METRICS_URL);
    const summary = parseMetricsSummary(metrics);
    slo_p95_ms = summary.p95Ms;
    slo_error_rate = summary.errorRate;
    slo_webhook_retry_rate = summary.webhookRetryRate;
    metric_jobs_processed_1h = summary.jobsProcessed1h;
    metric_jobs_pending = summary.jobsPending;
  } catch {
    // ignore
  }

  const cpuUsagePctRaw = (os.loadavg()[0] / Math.max(1, os.cpus().length)) * 100;
  const cpu_usage_pct = Number.isFinite(cpuUsagePctRaw) && cpuUsagePctRaw > 0 ? cpuUsagePctRaw : undefined;
  const memory_total_bytes = os.totalmem();
  const memory_used_bytes = memory_total_bytes - os.freemem();
  const disk = diskUsage(SYSTEM_ROOT_PATH);
  const network = await networkBytes();
  const db_size_bytes = await dbSizeBytes();
  const storage_size_bytes = await storageSizeBytes();

  let events_total_1h: number | undefined;
  let events_failed_1h: number | undefined;
  let events_avg_lag_ms: number | undefined;
  let feature_usage: unknown;
  const regionalHealth = await probeRegionalHealth();
  if (EVENTS_STATS_URL && OPS_TOKEN) {
    try {
      const stats = await fetchJson(EVENTS_STATS_URL, OPS_TOKEN);
      events_total_1h = stats.total1h;
      events_failed_1h = stats.failed1h;
      events_avg_lag_ms = stats.avgLagMs;
    } catch {
      // ignore
    }
  }

  if (FEATURE_USAGE_URL && OPS_TOKEN) {
    const now = new Date();
    const from = featureUsageCursor ?? new Date(now.getTime() - 60 * 60 * 1000);
    try {
      const params = new URLSearchParams();
      params.set("from", from.toISOString());
      params.set("to", now.toISOString());
      feature_usage = await fetchJson(`${FEATURE_USAGE_URL}?${params.toString()}`, OPS_TOKEN);
      featureUsageCursor = now;
    } catch {
      // ignore
    }
  }

  return validateHeartbeat({
    instance_id: INSTANCE_ID,
    domain: DOMAIN,
    client: CLIENT,
    version: VERSION,
    release_channel: RELEASE_CHANNEL,
    health: "ok",
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    db_ok,
    redis_ok,
    storage_ok,
    search_ok,
    jobs_failed,
    secrets_expired,
    secrets_unverified,
    last_backup_at,
    backup_id,
    backup_size_bytes,
    backup_checksum,
    backup_bucket,
    backup_path,
    cpu_usage_pct,
    memory_used_bytes,
    memory_total_bytes,
    disk_used_bytes: disk.used,
    disk_total_bytes: disk.total,
    network_rx_bytes: network.rx,
    network_tx_bytes: network.tx,
    db_size_bytes,
    storage_size_bytes,
    jobs_processed_1h: Math.max(jobs_processed_1h, metric_jobs_processed_1h ?? 0),
    jobs_pending: Math.max(jobs_pending, metric_jobs_pending ?? 0),
    iam_sso_enabled: IAM_SSO_ENABLED,
    iam_mfa_enforced: IAM_MFA_ENFORCED,
    iam_scim_enabled: IAM_SCIM_ENABLED,
    iam_last_sync_at: new Date().toISOString(),
    primary_region: PRIMARY_REGION || undefined,
    regional_health: regionalHealth.length > 0 ? regionalHealth : undefined,
    slo_p95_ms,
    slo_error_rate,
    slo_webhook_retry_rate,
    slo_updated_at: new Date().toISOString(),
    events_total_1h,
    events_failed_1h,
    events_avg_lag_ms,
    feature_usage,
  });
}

async function sendHeartbeat() {
  if (!INSTANCE_ID || !CONTROL_PLANE_URL || !AGENT_SECRET) {
    return;
  }

  const payload = await collectHeartbeat();
  const body = JSON.stringify(payload);
  const signature = signPayload(body, AGENT_SECRET);

  await fetch(`${CONTROL_PLANE_URL.replace(/\/$/, "")}/api/heartbeats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-signature": signature,
    },
    body,
  });

  if (EVENTS_INGEST_URL) {
    const eventPayload = [
      {
        id: `agent-${INSTANCE_ID}-${Date.now()}`,
        name: "AgentHeartbeat",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "agent",
        companyId: null,
        subjectId: INSTANCE_ID,
        payload: {
          instanceId: INSTANCE_ID,
          uptimeSeconds: payload.uptime_seconds,
        },
      },
    ];
    await fetch(EVENTS_INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    }).catch(() => undefined);
  }
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const token = req.headers["x-agent-local-token"] as string | undefined;
  if (!LOCAL_TOKEN || token === LOCAL_TOKEN) {
    return next();
  }
  return res.status(401).json({ error: "unauthorized" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/diagnostic", async (_req, res) => {
  if (!OPS_URL || !OPS_TOKEN) {
    return res.json({ ok: false, error: "OPS URL not configured" });
  }
  try {
    const data = await fetchJson(OPS_URL, OPS_TOKEN);
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: errorMessage(err) });
  }
});

app.get("/metrics", async (_req, res) => {
  try {
    const metrics = await fetchText(METRICS_URL);
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(metrics);
  } catch (err: unknown) {
    res.status(502).send(`metrics unavailable: ${errorMessage(err)}`);
  }
});

app.post("/smoke", async (_req, res) => {
  const results = {
    db_ok: await tcpCheck(DB_URL, 5432),
    redis_ok: await tcpCheck(REDIS_URL, 6379),
    storage_ok: STORAGE_ENDPOINT ? await tcpCheck(STORAGE_ENDPOINT, 9000) : true,
    search_ok: MEILI_HOST ? await tcpCheck(MEILI_HOST, 7700) : true,
  };
  res.json(results);
});

app.listen(LOCAL_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Instance agent listening on ${LOCAL_PORT}`);
});

setInterval(() => {
  sendHeartbeat().catch(() => undefined);
}, HEARTBEAT_INTERVAL_MIN * 60 * 1000);

sendHeartbeat().catch(() => undefined);

startUpdateLoop();
startPluginLoop();
