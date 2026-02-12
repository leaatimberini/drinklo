import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCb);

const STAGING_ENV = process.env.CHAOS_ENVIRONMENT ?? "staging";
const INSTANCE_ID = process.env.INSTANCE_ID ?? "unknown-instance";
const METRICS_URL = process.env.CHAOS_METRICS_URL ?? "http://localhost:3001/metrics";
const HEALTH_URL = process.env.CHAOS_HEALTH_URL ?? "http://localhost:3001/health";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "";
const CONTROL_PLANE_TOKEN = process.env.CONTROL_PLANE_INGEST_TOKEN ?? "";
const STEP_TIMEOUT_MS = Number(process.env.CHAOS_STEP_TIMEOUT_MS ?? 120000);
const WAIT_MS = Number(process.env.CHAOS_WAIT_MS ?? 5000);

const SLO_P95_MAX = Number(process.env.CHAOS_SLO_P95_MAX ?? process.env.BLUEGREEN_SLO_P95_MAX ?? 1500);
const SLO_ERROR_RATE_MAX = Number(process.env.CHAOS_SLO_ERROR_RATE_MAX ?? process.env.BLUEGREEN_SLO_ERROR_RATE_MAX ?? 0.02);
const SLO_WEBHOOK_RETRY_RATE_MAX = Number(
  process.env.CHAOS_SLO_WEBHOOK_RETRY_RATE_MAX ?? process.env.BLUEGREEN_SLO_WEBHOOK_RETRY_RATE_MAX ?? 0.05,
);

const scenarios = [
  {
    name: "redis_down",
    injectCmd: process.env.CHAOS_REDIS_DOWN_CMD ?? "",
    recoverCmd: process.env.CHAOS_REDIS_RECOVER_CMD ?? "",
  },
  {
    name: "db_latency",
    injectCmd: process.env.CHAOS_DB_LATENCY_CMD ?? "",
    recoverCmd: process.env.CHAOS_DB_LATENCY_RECOVER_CMD ?? "",
  },
  {
    name: "storage_loss",
    injectCmd: process.env.CHAOS_STORAGE_LOSS_CMD ?? "",
    recoverCmd: process.env.CHAOS_STORAGE_RECOVER_CMD ?? "",
  },
  {
    name: "webhooks_duplicated",
    injectCmd: process.env.CHAOS_WEBHOOK_DUPLICATE_CMD ?? "",
    recoverCmd: process.env.CHAOS_WEBHOOK_DUPLICATE_RECOVER_CMD ?? "",
  },
];

function parseLabels(segment) {
  const labels = {};
  const trimmed = String(segment ?? "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return labels;
  const parts = trimmed.slice(1, -1).split(",");
  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || !rawValue) continue;
    labels[rawKey.trim()] = rawValue.trim().replace(/^\"|\"$/g, "");
  }
  return labels;
}

function parseMetricsSummary(text) {
  let p95Ms;
  let totalRequests = 0;
  let errorRequests = 0;
  let webhooksTotal = 0;
  let webhookRetries = 0;

  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [metricPart, valuePart] = trimmed.split(" ");
    const value = Number(valuePart);
    if (!metricPart || !Number.isFinite(value)) continue;

    const hasLabels = metricPart.includes("{");
    const name = hasLabels ? metricPart.split("{")[0] : metricPart;
    const labels = hasLabels ? parseLabels(metricPart.slice(metricPart.indexOf("{"))) : {};

    if (name === "http_request_duration_ms" && labels.quantile === "0.95") {
      p95Ms = value;
    }
    if (name === "http_requests_total") {
      totalRequests += value;
      const status = labels.status ?? "";
      if (status.startsWith("5")) errorRequests += value;
    }
    if (name === "webhooks_total") webhooksTotal += value;
    if (name === "webhook_retries_total") webhookRetries += value;
  }

  return {
    p95Ms,
    errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
    webhookRetryRate: webhooksTotal > 0 ? webhookRetries / webhooksTotal : 0,
  };
}

async function runCmd(cmd) {
  if (!cmd) return;
  await exec(cmd, {
    cwd: process.cwd(),
    timeout: STEP_TIMEOUT_MS,
    env: process.env,
    windowsHide: true,
  });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHealth() {
  try {
    const res = await fetch(HEALTH_URL, { cache: "no-store" });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message ?? "health_error" };
  }
}

async function readSlo() {
  const res = await fetch(METRICS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`metrics unavailable: ${res.status}`);
  }
  return parseMetricsSummary(await res.text());
}

function evaluateSlo(slo) {
  const breaches = [];
  if (SLO_P95_MAX > 0 && Number.isFinite(slo.p95Ms) && slo.p95Ms > SLO_P95_MAX) {
    breaches.push(`p95 ${slo.p95Ms} > ${SLO_P95_MAX}`);
  }
  if (SLO_ERROR_RATE_MAX > 0 && Number.isFinite(slo.errorRate) && slo.errorRate > SLO_ERROR_RATE_MAX) {
    breaches.push(`errorRate ${slo.errorRate} > ${SLO_ERROR_RATE_MAX}`);
  }
  if (
    SLO_WEBHOOK_RETRY_RATE_MAX > 0 &&
    Number.isFinite(slo.webhookRetryRate) &&
    slo.webhookRetryRate > SLO_WEBHOOK_RETRY_RATE_MAX
  ) {
    breaches.push(`webhookRetryRate ${slo.webhookRetryRate} > ${SLO_WEBHOOK_RETRY_RATE_MAX}`);
  }
  return breaches;
}

async function reportToControlPlane(result) {
  if (!CONTROL_PLANE_URL || !CONTROL_PLANE_TOKEN) return;
  await fetch(`${CONTROL_PLANE_URL.replace(/\/$/, "")}/api/chaos/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cp-ingest-token": CONTROL_PLANE_TOKEN,
    },
    body: JSON.stringify(result),
  }).catch(() => undefined);
}

async function runScenario(scenario) {
  const startedAt = Date.now();
  const output = {
    instanceId: INSTANCE_ID,
    environment: STAGING_ENV,
    scenario: scenario.name,
    status: "ok",
    sloP95Ms: null,
    sloErrorRate: null,
    sloWebhookRetryRate: null,
    durationMs: 0,
    details: {},
  };

  try {
    await runCmd(scenario.injectCmd);
    await wait(WAIT_MS);

    const [health, slo] = await Promise.all([readHealth(), readSlo()]);
    output.sloP95Ms = slo.p95Ms ?? null;
    output.sloErrorRate = slo.errorRate ?? null;
    output.sloWebhookRetryRate = slo.webhookRetryRate ?? null;
    output.details.health = health;

    const breaches = evaluateSlo(slo);
    if (!health.ok || breaches.length > 0) {
      output.status = "degraded";
      output.details.breaches = breaches;
    }
  } catch (error) {
    output.status = "failed";
    output.details.error = error?.message ?? "scenario_error";
  } finally {
    try {
      await runCmd(scenario.recoverCmd);
    } catch (recoverError) {
      output.status = "failed";
      output.details.recoverError = recoverError?.message ?? "recover_error";
    }
    output.durationMs = Date.now() - startedAt;
    await reportToControlPlane(output);
  }

  return output;
}

async function main() {
  const results = [];
  for (const scenario of scenarios) {
    if (!scenario.injectCmd) {
      // eslint-disable-next-line no-console
      console.log(`[chaos] skip ${scenario.name} (inject command missing)`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`[chaos] running ${scenario.name}`);
    const result = await runScenario(scenario);
    results.push(result);
    // eslint-disable-next-line no-console
    console.log(`[chaos] ${scenario.name}: ${result.status}`);
  }

  const failed = results.filter((result) => result.status === "failed").length;
  const degraded = results.filter((result) => result.status === "degraded").length;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ environment: STAGING_ENV, instanceId: INSTANCE_ID, total: results.length, failed, degraded }, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[chaos] fatal", error?.message ?? error);
  process.exit(1);
});
