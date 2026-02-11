import express from "express";
import { signPayload } from "./signing";
import { validateHeartbeat, type HeartbeatPayload } from "./payload";
import { startUpdateLoop } from "./update";
import { startPluginLoop } from "./plugin-update";
import { parseMetricsSummary } from "./metrics";
import net from "node:net";
import fs from "node:fs";
import { setInterval } from "node:timers";

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

const startTime = Date.now();

function parseHostPort(url: string, defaultPort: number) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: Number(parsed.port || defaultPort) };
  } catch {
    return { host: "", port: defaultPort };
  }
}

async function tcpCheck(url: string, defaultPort: number) {
  if (!url) return false;
  const { host, port } = parseHostPort(url, defaultPort);
  if (!host) return false;

  return new Promise((resolve) => {
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

async function collectHeartbeat(): Promise<HeartbeatPayload> {
  const db_ok = await tcpCheck(DB_URL, 5432);
  const redis_ok = await tcpCheck(REDIS_URL, 6379);
  const storage_ok = STORAGE_ENDPOINT ? await tcpCheck(STORAGE_ENDPOINT, 9000) : true;
  const search_ok = MEILI_HOST ? await tcpCheck(MEILI_HOST, 7700) : true;

  let jobs_failed = 0;
  let secrets_expired = 0;
  let secrets_unverified = 0;
  if (OPS_URL && OPS_TOKEN) {
    try {
      const ops = await fetchJson(OPS_URL, OPS_TOKEN);
      jobs_failed = ops.jobFailures?.length ?? 0;
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
  try {
    const metrics = await fetchText(METRICS_URL);
    const summary = parseMetricsSummary(metrics);
    slo_p95_ms = summary.p95Ms;
    slo_error_rate = summary.errorRate;
    slo_webhook_retry_rate = summary.webhookRetryRate;
  } catch {
    // ignore
  }

  let events_total_1h: number | undefined;
  let events_failed_1h: number | undefined;
  let events_avg_lag_ms: number | undefined;
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
    slo_p95_ms,
    slo_error_rate,
    slo_webhook_retry_rate,
    slo_updated_at: new Date().toISOString(),
    events_total_1h,
    events_failed_1h,
    events_avg_lag_ms,
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
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "error" });
  }
});

app.get("/metrics", async (_req, res) => {
  try {
    const metrics = await fetchText(METRICS_URL);
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(metrics);
  } catch (err: any) {
    res.status(502).send(`metrics unavailable: ${err?.message ?? "error"}`);
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
