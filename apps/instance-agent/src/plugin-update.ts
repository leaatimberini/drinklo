import { exec } from "node:child_process";
import { promisify } from "node:util";
import { signPayload } from "./signing";

const execAsync = promisify(exec);

const PLUGIN_ENABLED = (process.env.PLUGIN_UPDATE_ENABLED ?? "true") === "true";
const PLUGIN_POLL_MIN = Number(process.env.PLUGIN_POLL_MIN ?? 10);
const PLUGIN_STEP_TIMEOUT_SEC = Number(process.env.PLUGIN_STEP_TIMEOUT_SEC ?? 600);
const PLUGIN_WORKDIR = process.env.PLUGIN_WORKDIR ?? process.cwd();

const PLUGIN_INSTALL_CMD = process.env.PLUGIN_INSTALL_CMD ?? "";
const PLUGIN_UPDATE_CMD = process.env.PLUGIN_UPDATE_CMD ?? "";
const PLUGIN_REMOVE_CMD = process.env.PLUGIN_REMOVE_CMD ?? "";
const PLUGIN_SMOKE_CMD = process.env.PLUGIN_SMOKE_CMD ?? "";

const INSTANCE_ID = process.env.INSTANCE_ID ?? "";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";

let inProgress = false;

function buildCmd(cmd: string, payload: { name: string; version?: string | null; action: string }) {
  return cmd
    .replaceAll("{{name}}", payload.name)
    .replaceAll("{{version}}", payload.version ?? "")
    .replaceAll("{{action}}", payload.action);
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

async function runCommand(cmd: string, timeoutSec: number) {
  if (!cmd) {
    throw new Error("command not configured");
  }
  await execAsync(cmd, {
    timeout: timeoutSec * 1000,
    cwd: PLUGIN_WORKDIR,
    env: process.env,
    windowsHide: true,
  });
}

async function report(jobId: string, status: string, step: string, error?: string, durationMs?: number) {
  await postSigned("/api/plugins/report", {
    instance_id: INSTANCE_ID,
    job_id: jobId,
    status,
    step,
    error,
    duration_ms: durationMs,
  });
}

async function applyJob(job: { job_id: string; plugin: { name: string; version?: string; action: string } }) {
  const start = Date.now();
  try {
    const cmd =
      job.plugin.action === "remove"
        ? buildCmd(PLUGIN_REMOVE_CMD, job.plugin)
        : job.plugin.action === "update"
          ? buildCmd(PLUGIN_UPDATE_CMD, job.plugin)
          : buildCmd(PLUGIN_INSTALL_CMD, job.plugin);

    await report(job.job_id, "in_progress", "install");
    await runCommand(cmd, PLUGIN_STEP_TIMEOUT_SEC);

    if (PLUGIN_SMOKE_CMD) {
      await report(job.job_id, "in_progress", "smoke");
      await runCommand(buildCmd(PLUGIN_SMOKE_CMD, job.plugin), PLUGIN_STEP_TIMEOUT_SEC);
    }

    const durationMs = Date.now() - start;
    await report(job.job_id, "succeeded", "done", undefined, durationMs);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    await report(job.job_id, "failed", "error", err?.message ?? "failed", durationMs);
  }
}

async function pollOnce() {
  if (!PLUGIN_ENABLED || inProgress) return;
  if (!INSTANCE_ID || !CONTROL_PLANE_URL || !AGENT_SECRET) return;
  inProgress = true;
  try {
    const result = await postSigned("/api/plugins/next", { instance_id: INSTANCE_ID });
    if (result && result.job_id) {
      await applyJob(result);
    }
  } finally {
    inProgress = false;
  }
}

export function startPluginLoop() {
  setInterval(() => {
    pollOnce().catch(() => undefined);
  }, PLUGIN_POLL_MIN * 60 * 1000);
  pollOnce().catch(() => undefined);
}
