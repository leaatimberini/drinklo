#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const escapedArgs = args.map((arg) => `'${String(arg).replace(/'/g, "''")}'`).join(" ");
    const child = process.platform === "win32"
      ? spawn(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", `& ${command} ${escapedArgs}`],
          {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
            env: process.env,
          },
        )
      : spawn(command, args, {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
          env: process.env,
        });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (err) => {
      stderr += String(err);
      resolve({ code: 1, stdout, stderr });
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function removeTmpEngineFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.includes("query_engine") && name.includes(".tmp")) {
      const full = path.join(dir, name);
      try {
        fs.unlinkSync(full);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function hasGeneratedClient(dir) {
  return (
    fs.existsSync(path.join(dir, "index.js"))
    && fs.existsSync(path.join(dir, "index.d.ts"))
  );
}

async function main() {
  const workspaceArg = process.argv[2];
  if (!workspaceArg) {
    console.error("[prisma-generate-safe] missing workspace path argument");
    process.exit(1);
  }

  const root = process.cwd();
  const workspaceDir = path.resolve(root, workspaceArg);
  const generatedDir = path.resolve(workspaceDir, "app/lib/generated/prisma");

  removeTmpEngineFiles(generatedDir);
  const first = await run("pnpm", ["prisma", "generate"], workspaceDir);
  if (first.code === 0) {
    process.exit(0);
  }

  const combined = `${first.stdout}\n${first.stderr}`;
  const isWindowsDllLock =
    process.platform === "win32"
    && combined.includes("EPERM")
    && combined.includes("query_engine-windows.dll.node");

  if (!isWindowsDllLock) {
    process.exit(first.code);
  }

  removeTmpEngineFiles(generatedDir);
  const second = await run("pnpm", ["prisma", "generate"], workspaceDir);
  if (second.code === 0) {
    process.exit(0);
  }

  if (hasGeneratedClient(generatedDir)) {
    console.warn(
      "[prisma-generate-safe] warning: Prisma generate failed due to locked Windows query engine. Using existing generated client.",
    );
    process.exit(0);
  }

  process.exit(second.code);
}

await main();
