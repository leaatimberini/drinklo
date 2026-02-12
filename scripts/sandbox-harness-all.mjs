#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const flows = [
  { name: "sandbox-flow", script: "scripts/sandbox-harness.mjs" },
];

for (const flow of flows) {
  const res = spawnSync(process.execPath, [flow.script], { stdio: "inherit", env: process.env });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

console.log("Sandbox harness completed");
