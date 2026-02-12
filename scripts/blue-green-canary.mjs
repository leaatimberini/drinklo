import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const WORKDIR = process.env.BLUEGREEN_WORKDIR ?? process.cwd();
const STEP_TIMEOUT_MS = Number(process.env.BLUEGREEN_STEP_TIMEOUT_MS ?? 15 * 60 * 1000);

const GREEN_UP_CMD = process.env.BLUEGREEN_GREEN_UP_CMD ?? "";
const MIGRATE_SAFE_CMD = process.env.BLUEGREEN_MIGRATE_SAFE_CMD ?? "";
const SMOKE_CMD = process.env.BLUEGREEN_SMOKE_CMD ?? "";
const PROXY_SHIFT_CMD = process.env.BLUEGREEN_PROXY_SHIFT_CMD ?? "";
const PROXY_SWITCH_GREEN_CMD = process.env.BLUEGREEN_PROXY_SWITCH_GREEN_CMD ?? "";
const ROLLBACK_CMD = process.env.BLUEGREEN_ROLLBACK_CMD ?? "";
const METRICS_URL = process.env.BLUEGREEN_METRICS_URL ?? "";
const SLO_P95_MAX = Number(process.env.BLUEGREEN_SLO_P95_MAX ?? 0);
const SLO_ERROR_RATE_MAX = Number(process.env.BLUEGREEN_SLO_ERROR_RATE_MAX ?? 0);
const SLO_WEBHOOK_RETRY_RATE_MAX = Number(process.env.BLUEGREEN_SLO_WEBHOOK_RETRY_RATE_MAX ?? 0);
const STEPS = (process.env.BLUEGREEN_CANARY_STEPS ?? "5,25,100")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v > 0 && v <= 100);
const WAIT_SEC = Number(process.env.BLUEGREEN_CANARY_WAIT_SEC ?? 120);

async function run(name, cmd, env = {}) {
  if (!cmd) {
    throw new Error(`${name} command not configured`);
  }
  // eslint-disable-next-line no-console
  console.log(`[bluegreen] ${name}`);
  await execAsync(cmd, {
    cwd: WORKDIR,
    timeout: STEP_TIMEOUT_MS,
    env: { ...process.env, ...env },
    windowsHide: true,
  });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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
    errorRate: totalRequests > 0 ? errorRequests / totalRequests : undefined,
    webhookRetryRate: webhooksTotal > 0 ? webhookRetries / webhooksTotal : undefined,
  };
}

async function assertSlo() {
  if (!METRICS_URL) return;

  const res = await fetch(METRICS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`metrics unavailable: ${res.status}`);
  const metrics = parseMetricsSummary(await res.text());

  if (SLO_P95_MAX > 0 && Number.isFinite(metrics.p95Ms) && metrics.p95Ms > SLO_P95_MAX) {
    throw new Error(`SLO breach p95 ${metrics.p95Ms} > ${SLO_P95_MAX}`);
  }
  if (SLO_ERROR_RATE_MAX > 0 && Number.isFinite(metrics.errorRate) && metrics.errorRate > SLO_ERROR_RATE_MAX) {
    throw new Error(`SLO breach error rate ${metrics.errorRate} > ${SLO_ERROR_RATE_MAX}`);
  }
  if (
    SLO_WEBHOOK_RETRY_RATE_MAX > 0 &&
    Number.isFinite(metrics.webhookRetryRate) &&
    metrics.webhookRetryRate > SLO_WEBHOOK_RETRY_RATE_MAX
  ) {
    throw new Error(
      `SLO breach webhook retry ${metrics.webhookRetryRate} > ${SLO_WEBHOOK_RETRY_RATE_MAX}`,
    );
  }
}

async function main() {
  try {
    await run("green_up", GREEN_UP_CMD);
    await run("migrate_safe", MIGRATE_SAFE_CMD);
    await run("smoke", SMOKE_CMD);

    for (const percent of STEPS) {
      await run("canary_shift", PROXY_SHIFT_CMD, { UPDATE_CANARY_PERCENT: String(percent) });
      await sleep(Math.max(0, WAIT_SEC) * 1000);
      await assertSlo();
    }

    await run("switch_green", PROXY_SWITCH_GREEN_CMD);
    // eslint-disable-next-line no-console
    console.log("[bluegreen] completed");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[bluegreen] failed", error?.message ?? error);
    if (ROLLBACK_CMD) {
      await run("rollback", ROLLBACK_CMD);
    }
    process.exit(1);
  }
}

main();
