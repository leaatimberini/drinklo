import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCb);

const PRIMARY_HEALTH_URL = process.env.FAILOVER_PRIMARY_HEALTH_URL ?? "";
const SECONDARY_HEALTH_URL = process.env.FAILOVER_SECONDARY_HEALTH_URL ?? "";
const STOREFRONT_URL = process.env.FAILOVER_STOREFRONT_URL ?? "";
const SMOKE_CMD = process.env.FAILOVER_SMOKE_CMD ?? "";

async function probe(name, url) {
  if (!url) {
    console.log(`[failover-sim] skip ${name} probe (url missing)`);
    return false;
  }
  const started = Date.now();
  try {
    const response = await fetch(url, { cache: "no-store" });
    const ms = Date.now() - started;
    console.log(`[failover-sim] ${name}: ${response.status} (${ms}ms)`);
    return response.ok;
  } catch (error) {
    console.log(`[failover-sim] ${name}: fail (${error?.message ?? "error"})`);
    return false;
  }
}

async function main() {
  console.log("[failover-sim] starting staging simulation");

  const primaryOk = await probe("primary", PRIMARY_HEALTH_URL);
  const secondaryOk = await probe("secondary", SECONDARY_HEALTH_URL);

  if (!secondaryOk) {
    throw new Error("secondary region is not healthy; aborting simulation");
  }

  if (STOREFRONT_URL) {
    const storefrontProbe = await probe("storefront", `${STOREFRONT_URL.replace(/\/$/, "")}/products`);
    if (!storefrontProbe) {
      throw new Error("storefront probe failed");
    }
  }

  if (!primaryOk) {
    console.log("[failover-sim] primary is already down; validating secondary-read mode");
  } else {
    console.log("[failover-sim] primary is healthy; run controlled outage manually to validate fallback");
  }

  if (SMOKE_CMD) {
    console.log("[failover-sim] running smoke command");
    await exec(SMOKE_CMD, {
      cwd: process.cwd(),
      timeout: 10 * 60 * 1000,
      env: process.env,
      windowsHide: true,
    });
  }

  console.log("[failover-sim] completed");
}

main().catch((error) => {
  console.error("[failover-sim] failed", error?.message ?? error);
  process.exit(1);
});
