import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import process from "node:process";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5432/erp?schema=public",
};

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed with ${code}`));
    });
  });
}

function start(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
  return child;
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
    await sleep(1000);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  await run("docker", ["compose", "up", "-d"]);
  await run("pnpm", ["-C", "packages/db", "migrate", "reset", "--force"], { env });

  const dev = start("pnpm", [
    "dev",
    "--filter",
    "@erp/api",
    "--filter",
    "@erp/admin",
    "--filter",
    "@erp/storefront",
  ]);

  try {
    await waitFor("http://localhost:3001/health");
    await waitFor("http://localhost:3002");
    await waitFor("http://localhost:3003");

    await run("pnpm", ["e2e"], { env });
  } finally {
    dev.kill("SIGINT");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
