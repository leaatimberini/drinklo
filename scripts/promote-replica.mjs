import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCb);

const WORKDIR = process.env.FAILOVER_WORKDIR ?? process.cwd();
const PRECHECK_CMD = process.env.FAILOVER_PRECHECK_CMD ?? "";
const PROMOTE_CMD = process.env.FAILOVER_PROMOTE_CMD ?? "";
const REPOINT_CMD = process.env.FAILOVER_REPOINT_CMD ?? "";
const VERIFY_CMD = process.env.FAILOVER_VERIFY_CMD ?? "";
const TIMEOUT_MS = Number(process.env.FAILOVER_STEP_TIMEOUT_MS ?? 10 * 60 * 1000);
const DRY_RUN = String(process.env.FAILOVER_DRY_RUN ?? "true").toLowerCase() === "true";

async function runStep(name, command) {
  if (!command) {
    console.log(`[failover] skip ${name} (command not configured)`);
    return;
  }
  if (DRY_RUN) {
    console.log(`[failover] dry-run ${name}: ${command}`);
    return;
  }
  console.log(`[failover] run ${name}`);
  await exec(command, {
    cwd: WORKDIR,
    timeout: TIMEOUT_MS,
    env: process.env,
    windowsHide: true,
  });
}

async function main() {
  console.log("[failover] Assisted manual failover checklist");
  console.log("1) Confirm replication is healthy and lag is acceptable.");
  console.log("2) Freeze writes in primary region.");
  console.log("3) Promote read replica to primary.");
  console.log("4) Repoint API/app traffic to new primary.");
  console.log("5) Run smoke and functional checks.");
  console.log("6) Keep old primary isolated until validation completes.");

  await runStep("precheck", PRECHECK_CMD);
  await runStep("promote", PROMOTE_CMD);
  await runStep("repoint", REPOINT_CMD);
  await runStep("verify", VERIFY_CMD);

  console.log("[failover] completed");
}

main().catch((error) => {
  console.error("[failover] failed", error?.message ?? error);
  process.exit(1);
});
