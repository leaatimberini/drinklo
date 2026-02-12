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

async function main() {
  try {
    await run("green_up", GREEN_UP_CMD);
    await run("migrate_safe", MIGRATE_SAFE_CMD);
    await run("smoke", SMOKE_CMD);

    for (const percent of STEPS) {
      await run("canary_shift", PROXY_SHIFT_CMD, { UPDATE_CANARY_PERCENT: String(percent) });
      await sleep(Math.max(0, WAIT_SEC) * 1000);
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
