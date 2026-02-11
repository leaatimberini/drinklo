import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import crypto from "node:crypto";
import readline from "node:readline";

const stagingApi = process.env.STAGING_API_URL ?? "";
const stagingToken = process.env.STAGING_ADMIN_TOKEN ?? "";
const prodApi = process.env.PROD_API_URL ?? "";
const prodSuperadminToken = process.env.PROD_SUPERADMIN_TOKEN ?? "";
const provisionCmd = process.env.PROD_PROVISION_CMD ?? "";
const backupDir = process.env.PROMOTE_BACKUP_DIR ?? "./backups/promotion";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed`);
  }
}

async function waitFor(url, timeoutMs = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await sleep(2000);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function promptChecklist(label) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`${label} (y/n): `, resolve));
  rl.close();
  return String(answer).trim().toLowerCase().startsWith("y");
}

async function exportBranding() {
  if (!stagingApi || !stagingToken) {
    throw new Error("STAGING_API_URL and STAGING_ADMIN_TOKEN are required");
  }
  const res = await fetch(`${stagingApi.replace(/\/$/, "")}/admin/branding/export`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stagingToken}` },
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.message ?? "Branding export failed");
  }
  return res.json();
}

async function importBranding(payload, signature) {
  if (!prodApi || !prodSuperadminToken) {
    throw new Error("PROD_API_URL and PROD_SUPERADMIN_TOKEN are required");
  }
  const res = await fetch(`${prodApi.replace(/\/$/, "")}/admin/branding/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-superadmin-token": prodSuperadminToken,
    },
    body: JSON.stringify({ payload, signature, apply: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "Branding import failed");
  }
}

async function main() {
  console.log("Starting promotion to prod...");

  console.log("1) Backup staging...");
  run("pnpm", ["backup:run"], { env: { ...process.env, BACKUP_DIR: backupDir } });

  console.log("2) Export branding/config from staging...");
  const exportData = await exportBranding();

  console.log("3) Provision prod...");
  if (provisionCmd) {
    run(provisionCmd, []);
  } else {
    console.log("PROD_PROVISION_CMD not set. Skipping provision step.");
  }

  console.log("4) Import branding/config to prod...");
  await importBranding(exportData.payload, exportData.signature);

  console.log("5) Smoke tests post-deploy...");
  if (prodApi) {
    await waitFor(`${prodApi.replace(/\/$/, "")}/health`);
    await waitFor(`${prodApi.replace(/\/$/, "")}/version`);
  }

  console.log("6) Final checklist...");
  const checks = [
    "Pagos (Mercado Pago)",
    "Envíos (Andreani / reparto)",
    "Bot (Telegram)",
    "AFIP (si aplica)",
  ];

  for (const item of checks) {
    const ok = await promptChecklist(item);
    if (!ok) {
      console.error(`Checklist failed: ${item}`);
      process.exit(1);
    }
  }

  console.log("Promotion completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
