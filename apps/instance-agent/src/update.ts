import { exec } from "node:child_process";
import { promisify } from "node:util";
import { signPayload } from "./signing";
import { parseMetricsSummary } from "./metrics";

const execAsync = promisify(exec);

type UpdateJob = {
  job_id: string;
  manifest: {
    version: string;
    sha: string;
    channel: string;
    migrations_required: boolean;
    breaking_changes?: string | null;
    released_at: string;
    signature: string;
  };
  rollout?: {
    strategy?: string;
    canary_steps?: number[];
    canary_step_wait_sec?: number;
    slo_p95_max?: number | null;
    slo_error_rate_max?: number | null;
    slo_webhook_retry_rate_max?: number | null;
    auto_rollback?: boolean;
  };
};

const UPDATE_ENABLED = (process.env.UPDATE_ENABLED ?? "true") === "true";
const UPDATE_POLL_MIN = Number(process.env.UPDATE_POLL_MIN ?? 10);
const UPDATE_STEP_TIMEOUT_SEC = Number(process.env.UPDATE_STEP_TIMEOUT_SEC ?? 900);
const UPDATE_WORKDIR = process.env.UPDATE_WORKDIR ?? process.cwd();

const UPDATE_BACKUP_CMD = process.env.UPDATE_BACKUP_CMD ?? "";
const UPDATE_PULL_CMD = process.env.UPDATE_PULL_CMD ?? "";
const UPDATE_MIGRATE_CMD = process.env.UPDATE_MIGRATE_CMD ?? "";
const UPDATE_MIGRATE_SAFE_CMD = process.env.UPDATE_MIGRATE_SAFE_CMD ?? UPDATE_MIGRATE_CMD;
const UPDATE_SMOKE_CMD = process.env.UPDATE_SMOKE_CMD ?? "";
const UPDATE_SWITCH_CMD = process.env.UPDATE_SWITCH_CMD ?? "";
const UPDATE_HEALTHCHECK_URL = process.env.UPDATE_HEALTHCHECK_URL ?? "";
const UPDATE_ROLLBACK_CMD = process.env.UPDATE_ROLLBACK_CMD ?? "";
const UPDATE_GREEN_UP_CMD = process.env.UPDATE_GREEN_UP_CMD ?? "";
const UPDATE_PROXY_SHIFT_CMD = process.env.UPDATE_PROXY_SHIFT_CMD ?? "";
const UPDATE_PROXY_SWITCH_GREEN_CMD = process.env.UPDATE_PROXY_SWITCH_GREEN_CMD ?? UPDATE_SWITCH_CMD;
const UPDATE_METRICS_URL = process.env.UPDATE_METRICS_URL ?? "http://api:3001/metrics";
const UPDATE_SLO_P95_MAX = Number(process.env.UPDATE_SLO_P95_MAX ?? 0);
const UPDATE_SLO_ERROR_RATE_MAX = Number(process.env.UPDATE_SLO_ERROR_RATE_MAX ?? 0);
const UPDATE_SLO_WEBHOOK_RETRY_RATE_MAX = Number(process.env.UPDATE_SLO_WEBHOOK_RETRY_RATE_MAX ?? 0);
const UPDATE_CANARY_STEPS = (process.env.UPDATE_CANARY_STEPS ?? "5,25,100")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0 && value <= 100);
const UPDATE_CANARY_STEP_WAIT_SEC = Number(process.env.UPDATE_CANARY_STEP_WAIT_SEC ?? 120);

const INSTANCE_ID = process.env.INSTANCE_ID ?? "";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";
const VERSION = process.env.INSTANCE_VERSION ?? undefined;

let updateInProgress = false;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function postSigned(path: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, AGENT_SECRET);
  const res = await fetch(`${CONTROL_PLANE_URL.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-signature": signature,
    },
    body,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "request failed");
  }
  return res.json();
}

async function runCommand(step: string, cmd: string) {
  if (!cmd) {
    throw new Error(`${step} command not configured`);
  }
  await execAsync(cmd, {
    timeout: UPDATE_STEP_TIMEOUT_SEC * 1000,
    cwd: UPDATE_WORKDIR,
    env: process.env,
    windowsHide: true,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealth() {
  if (!UPDATE_HEALTHCHECK_URL) return;
  const res = await fetch(UPDATE_HEALTHCHECK_URL);
  if (!res.ok) {
    throw new Error(`health check failed: ${res.status}`);
  }
}

async function report(jobId: string, status: string, step: string, error?: string) {
  await postSigned("/api/updates/report", {
    instance_id: INSTANCE_ID,
    job_id: jobId,
    status,
    step,
    error,
  });
}

async function reportCanaryMetrics(
  jobId: string,
  step: string,
  canaryPercent: number,
  metrics: { p95Ms?: number; errorRate?: number; webhookRetryRate?: number },
) {
  await postSigned("/api/updates/report", {
    instance_id: INSTANCE_ID,
    job_id: jobId,
    status: "in_progress",
    step,
    canary_percent: canaryPercent,
    metric_p95_ms: metrics.p95Ms ?? null,
    metric_error_rate: metrics.errorRate ?? null,
    metric_webhook_retry_rate: metrics.webhookRetryRate ?? null,
  });
}

async function loadMetrics() {
  const res = await fetch(UPDATE_METRICS_URL);
  if (!res.ok) {
    throw new Error(`metrics fetch failed: ${res.status}`);
  }
  const text = await res.text();
  return parseMetricsSummary(text);
}

function getSloThresholds(job: UpdateJob) {
  return {
    p95Max:
      Number(job.rollout?.slo_p95_max ?? 0) > 0
        ? Number(job.rollout?.slo_p95_max)
        : UPDATE_SLO_P95_MAX,
    errorRateMax:
      Number(job.rollout?.slo_error_rate_max ?? 0) > 0
        ? Number(job.rollout?.slo_error_rate_max)
        : UPDATE_SLO_ERROR_RATE_MAX,
    webhookRetryRateMax:
      Number(job.rollout?.slo_webhook_retry_rate_max ?? 0) > 0
        ? Number(job.rollout?.slo_webhook_retry_rate_max)
        : UPDATE_SLO_WEBHOOK_RETRY_RATE_MAX,
  };
}

function checkSloBreach(
  metrics: { p95Ms?: number; errorRate?: number; webhookRetryRate?: number },
  thresholds: { p95Max: number; errorRateMax: number; webhookRetryRateMax: number },
) {
  if (thresholds.p95Max > 0 && metrics.p95Ms != null && metrics.p95Ms > thresholds.p95Max) {
    return `p95 breach ${metrics.p95Ms} > ${thresholds.p95Max}`;
  }
  if (
    thresholds.errorRateMax > 0 &&
    metrics.errorRate != null &&
    metrics.errorRate > thresholds.errorRateMax
  ) {
    return `error rate breach ${metrics.errorRate} > ${thresholds.errorRateMax}`;
  }
  if (
    thresholds.webhookRetryRateMax > 0 &&
    metrics.webhookRetryRate != null &&
    metrics.webhookRetryRate > thresholds.webhookRetryRateMax
  ) {
    return `webhook retry breach ${metrics.webhookRetryRate} > ${thresholds.webhookRetryRateMax}`;
  }
  return null;
}

async function rollback(jobId: string, reason: string) {
  try {
    await report(jobId, "failed", "rollback", reason);
    if (UPDATE_ROLLBACK_CMD) {
      await execAsync(UPDATE_ROLLBACK_CMD, {
        timeout: UPDATE_STEP_TIMEOUT_SEC * 1000,
        cwd: UPDATE_WORKDIR,
        env: process.env,
        windowsHide: true,
      });
    }
    await report(jobId, "rolled_back", "rollback");
  } catch (err: unknown) {
    await report(jobId, "failed", "rollback", errorMessage(err));
  }
}

async function applyUpdate(job: UpdateJob) {
  const jobId = job.job_id;
  const strategy = String(job.rollout?.strategy ?? "BATCH").toUpperCase();
  const canarySteps =
    Array.isArray(job.rollout?.canary_steps) && job.rollout?.canary_steps.length > 0
      ? job.rollout?.canary_steps
      : UPDATE_CANARY_STEPS;
  const canaryStepWaitSec =
    Number(job.rollout?.canary_step_wait_sec ?? 0) > 0
      ? Number(job.rollout?.canary_step_wait_sec)
      : UPDATE_CANARY_STEP_WAIT_SEC;
  const autoRollback = job.rollout?.auto_rollback ?? true;
  try {
    await report(jobId, "in_progress", "backup");
    await runCommand("backup", UPDATE_BACKUP_CMD);

    await report(jobId, "in_progress", "pull");
    await runCommand("pull", UPDATE_PULL_CMD);

    if (strategy === "BLUE_GREEN_CANARY") {
      await report(jobId, "in_progress", "green_up");
      await runCommand("green_up", UPDATE_GREEN_UP_CMD);

      await report(jobId, "in_progress", "migrate_safe");
      await runCommand("migrate_safe", UPDATE_MIGRATE_SAFE_CMD);

      await report(jobId, "in_progress", "smoke");
      await runCommand("smoke", UPDATE_SMOKE_CMD);

      const thresholds = getSloThresholds(job);
      for (const stepPercent of canarySteps) {
        await report(jobId, "in_progress", "canary_shift");
        const cmd = UPDATE_PROXY_SHIFT_CMD;
        if (!cmd) {
          throw new Error("canary shift command not configured");
        }
        await execAsync(cmd, {
          timeout: UPDATE_STEP_TIMEOUT_SEC * 1000,
          cwd: UPDATE_WORKDIR,
          env: {
            ...process.env,
            UPDATE_CANARY_PERCENT: String(stepPercent),
          },
          windowsHide: true,
        });

        await sleep(Math.max(0, canaryStepWaitSec) * 1000);
        const metrics = await loadMetrics();
        await reportCanaryMetrics(jobId, "canary_observe", stepPercent, metrics);

        const breach = checkSloBreach(metrics, thresholds);
        if (breach) {
          throw new Error(`SLO breach during canary ${stepPercent}%: ${breach}`);
        }
      }

      await report(jobId, "in_progress", "switch_green");
      await runCommand("switch_green", UPDATE_PROXY_SWITCH_GREEN_CMD);
    } else {
      await report(jobId, "in_progress", "migrate");
      await runCommand("migrate", UPDATE_MIGRATE_CMD);

      await report(jobId, "in_progress", "smoke");
      await runCommand("smoke", UPDATE_SMOKE_CMD);

      await report(jobId, "in_progress", "switch");
      await runCommand("switch", UPDATE_SWITCH_CMD);
    }

    await report(jobId, "in_progress", "health");
    await checkHealth();

    await report(jobId, "succeeded", "done");
  } catch (err: unknown) {
    if (autoRollback) {
      await rollback(jobId, errorMessage(err));
    } else {
      await report(jobId, "failed", "done", errorMessage(err));
    }
  }
}

async function pollOnce() {
  if (!UPDATE_ENABLED || updateInProgress) return;
  if (!INSTANCE_ID || !CONTROL_PLANE_URL || !AGENT_SECRET) return;

  updateInProgress = true;
  try {
    const result = await postSigned("/api/updates/next", {
      instance_id: INSTANCE_ID,
      current_version: VERSION ?? null,
    });
    if (result && result.job_id) {
      await applyUpdate(result as UpdateJob);
    }
  } finally {
    updateInProgress = false;
  }
}

export function startUpdateLoop() {
  setInterval(() => {
    pollOnce().catch(() => undefined);
  }, UPDATE_POLL_MIN * 60 * 1000);

  pollOnce().catch(() => undefined);
}
