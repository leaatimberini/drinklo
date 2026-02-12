#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const controllersRoot = path.join(root, "apps", "api", "src", "modules");
const outputDir = path.join(root, "packages", "shared", "contracts", "openapi");
const policyPath = path.join(root, "packages", "shared", "contracts", "api-version-policy.json");

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".controller.ts")) {
      result.push(full);
    }
  }
  return result;
}

function extractFirstStringArgument(text) {
  if (!text) return "";
  const m = text.match(/["'`]([^"'`]*)["'`]/);
  return m?.[1] ?? "";
}

function normalizePath(basePath, routePath) {
  const parts = [basePath || "", routePath || ""]
    .join("/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return `/${parts.join("/")}`;
}

function toOperationId(method, fullPath) {
  const clean = fullPath.replace(/^\//, "").replace(/[/:{}-]+/g, "_") || "root";
  return `${method}_${clean}`;
}

function buildPaths() {
  const files = walk(controllersRoot);
  const paths = {};

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    let controllerBase = "";
    const lines = source.split(/\r?\n/);

    for (const line of lines) {
      const controllerMatch = line.match(/@Controller\(([^)]*)\)/);
      if (controllerMatch) {
        controllerBase = extractFirstStringArgument(controllerMatch[1]);
        continue;
      }

      const routeMatch = line.match(/@(Get|Post|Put|Patch|Delete|Head|Options)\(([^)]*)\)/);
      if (!routeMatch) {
        continue;
      }

      const httpMethod = routeMatch[1].toLowerCase();
      const routePath = extractFirstStringArgument(routeMatch[2]);
      const fullPath = normalizePath(controllerBase, routePath);
      if (!paths[fullPath]) {
        paths[fullPath] = {};
      }
      paths[fullPath][httpMethod] = {
        operationId: toOperationId(httpMethod, fullPath),
        responses: {
          200: {
            description: "OK",
          },
        },
        "x-source": path.relative(root, file).replace(/\\/g, "/"),
      };
    }
  }

  return paths;
}

function loadPolicy() {
  if (!fs.existsSync(policyPath)) {
    return {
      supportedVersions: [1],
      defaultVersion: 1,
      latestVersion: 1,
      deprecations: {},
    };
  }
  const raw = fs.readFileSync(policyPath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function writeSpec(version, paths, policy) {
  const deprecation = policy.deprecations?.[String(version)] ?? null;
  const spec = {
    openapi: "3.0.3",
    info: {
      title: `ERP API v${version}`,
      version: `v${version}`,
      description:
        deprecation
          ? `Deprecated on ${deprecation.deprecatedOn}. Sunset on ${deprecation.sunsetOn}. Migrate to v${deprecation.successor}.`
          : `Stable contract for API version v${version}.`,
    },
    paths,
    "x-api-version": version,
    "x-default-version": policy.defaultVersion,
    "x-supported-versions": policy.supportedVersions,
    "x-deprecation": deprecation,
  };

  const outFile = path.join(outputDir, `v${version}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
}

function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const paths = buildPaths();
  const policy = loadPolicy();

  for (const version of policy.supportedVersions ?? [1]) {
    writeSpec(version, paths, policy);
  }

  const baselinePath = path.join(outputDir, "v1.baseline.json");
  const v1Path = path.join(outputDir, "v1.json");
  if (!fs.existsSync(baselinePath) && fs.existsSync(v1Path)) {
    fs.copyFileSync(v1Path, baselinePath);
  }

  const count = Object.keys(paths).length;
  console.log(`Generated OpenAPI contracts for versions ${policy.supportedVersions.join(", ")} with ${count} paths.`);
}

main();
