#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const openApiDir = path.join(root, "packages", "shared", "contracts", "openapi");
const targetDir = path.join(root, "apps", "control-plane", "public", "developer-api");
const openApiTargetDir = path.join(targetDir, "openapi");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildCatalog(spec) {
  const endpoints = [];
  for (const [route, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      endpoints.push({
        method: String(method).toUpperCase(),
        route,
        operationId: operation?.operationId ?? "",
        source: operation?.["x-source"] ?? null,
      });
    }
  }

  endpoints.sort((a, b) => {
    if (a.route === b.route) {
      return a.method.localeCompare(b.method);
    }
    return a.route.localeCompare(b.route);
  });

  return {
    generatedAt: new Date().toISOString(),
    version: spec.info?.version ?? "v1",
    title: spec.info?.title ?? "ERP API",
    endpointCount: endpoints.length,
    endpoints,
  };
}

function buildChangelog() {
  let output = "";
  try {
    output = execSync('git log --date=short --pretty=format:"%h|%ad|%s" -- apps/api packages/shared/contracts/openapi', {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 1024 * 1024,
    });
  } catch {
    output = "";
  }

  const entries = output
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 80)
    .map((line) => {
      const [sha, date, ...subjectParts] = line.split("|");
      return {
        sha,
        date,
        subject: subjectParts.join("|").trim(),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
}

function main() {
  ensureDir(targetDir);
  ensureDir(openApiTargetDir);

  const versions = ["v1", "v2"];
  const catalogs = [];

  for (const version of versions) {
    const sourcePath = path.join(openApiDir, `${version}.json`);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const spec = readJson(sourcePath);
    const targetPath = path.join(openApiTargetDir, `${version}.json`);
    fs.copyFileSync(sourcePath, targetPath);

    const catalog = buildCatalog(spec);
    catalogs.push(catalog);
    writeJson(path.join(targetDir, `${version}.catalog.json`), catalog);
  }

  writeJson(path.join(targetDir, "index.json"), {
    generatedAt: new Date().toISOString(),
    versions: catalogs.map((item) => ({
      version: item.version,
      endpointCount: item.endpointCount,
      title: item.title,
    })),
  });

  writeJson(path.join(targetDir, "changelog.json"), buildChangelog());

  console.log(`Developer portal assets generated in ${path.relative(root, targetDir)}`);
}

main();
