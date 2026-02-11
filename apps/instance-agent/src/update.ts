import { exec } from "node:child_process";
import { promisify } from "node:util";
import { signPayload } from "./signing";

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
};

const UPDATE_ENABLED = (process.env.UPDATE_ENABLED ?? "true") === "true";
const UPDATE_POLL_MIN = Number(process.env.UPDATE_POLL_MIN ?? 10);
const UPDATE_STEP_TIMEOUT_SEC = Number(process.env.UPDATE_STEP_TIMEOUT_SEC ?? 900);
const UPDATE_WORKDIR = process.env.UPDATE_WORKDIR ?? process.cwd();

const UPDATE_BACKUP_CMD = process.env.UPDATE_BACKUP_CMD ?? "";
const UPDATE_PULL_CMD = process.env.UPDATE_PULL_CMD ?? "";
const UPDATE_MIGRATE_CMD = process.env.UPDATE_MIGRATE_CMD ?? "";
const UPDATE_SMOKE_CMD = process.env.UPDATE_SMOKE_CMD ?? "";
const UPDATE_SWITCH_CMD = process.env.UPDATE_SWITCH_CMD ?? "";
const UPDATE_HEALTHCHECK_URL = process.env.UPDATE_HEALTHCHECK_URL ?? "";
const UPDATE_ROLLBACK_CMD = process.env.UPDATE_ROLLBACK_CMD ?? "";

const INSTANCE_ID = process.env.INSTANCE_ID ?? "";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";
const VERSION = process.env.INSTANCE_VERSION ?? undefined;

let updateInProgress = false;

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
  } catch (err: any) {
    await report(jobId, "failed", "rollback", err?.message ?? "rollback failed");
  }
}

async function applyUpdate(job: UpdateJob) {
  const jobId = job.job_id;
  try {
    await report(jobId, "in_progress", "backup");
    await runCommand("backup", UPDATE_BACKUP_CMD);

    await report(jobId, "in_progress", "pull");
    await runCommand("pull", UPDATE_PULL_CMD);

    await report(jobId, "in_progress", "migrate");
    await runCommand("migrate", UPDATE_MIGRATE_CMD);

    await report(jobId, "in_progress", "smoke");
    await runCommand("smoke", UPDATE_SMOKE_CMD);

    await report(jobId, "in_progress", "switch");
    await runCommand("switch", UPDATE_SWITCH_CMD);

    await report(jobId, "in_progress", "health");
    await checkHealth();

    await report(jobId, "succeeded", "done");
  } catch (err: any) {
    await rollback(jobId, err?.message ?? "update failed");
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
