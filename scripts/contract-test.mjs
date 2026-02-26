#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function normalizeDynamic(pathValue) {
  return pathValue
    .split("?")[0]
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/:[A-Za-z0-9_]+/g, ":param")
    .replace(/([A-Za-z0-9_.-]):param/g, "$1")
    .replace(/\$\{[^}]*$/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "/";
}

function collectApiPathsFromCode(dir) {
  const result = new Set();

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || !/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        continue;
      }
      const text = fs.readFileSync(full, "utf8");

      const templateUrl = /fetch\(\s*`([^`]+)`/g;
      let t;
      while ((t = templateUrl.exec(text))) {
        const template = t[1];
        const firstExpr = template.search(/\$\{[^}]+\}/);
        if (firstExpr < 0) continue;
        const closeExpr = template.indexOf("}", firstExpr);
        if (closeExpr < 0) continue;
        const rawPath = template.slice(closeExpr + 1);
        if (!rawPath.startsWith("/")) continue;
        result.add(normalizeDynamic(rawPath));
      }

      const requestPath = /request\s*<[^>]*>\s*\(\s*["'`]([^"'`]+)["'`]/g;
      let r;
      while ((r = requestPath.exec(text))) {
        if (!r[1].startsWith("/")) continue;
        result.add(normalizeDynamic(r[1]));
      }

      const requestPathNoGeneric = /request\s*\(\s*["'`]([^"'`]+)["'`]/g;
      let rn;
      while ((rn = requestPathNoGeneric.exec(text))) {
        if (!rn[1].startsWith("/")) continue;
        result.add(normalizeDynamic(rn[1]));
      }
    }
  }

  walk(dir);
  return [...result];
}

function pathExists(openapiPaths, requestedPath) {
  const normalizedRequested = normalizeDynamic(requestedPath);
  if (openapiPaths[normalizedRequested]) return true;

  for (const candidate of Object.keys(openapiPaths)) {
    const normalizedCandidate = normalizeDynamic(candidate);
    if (normalizedCandidate === normalizedRequested) {
      return true;
    }
    // Allow dynamic client helpers like `/billing/${kind}` to match concrete OpenAPI paths
    // when segment counts align (e.g. `/billing/:param` vs `/billing/upgrade`).
    const reqParts = normalizedRequested.split("/").filter(Boolean);
    const candParts = normalizedCandidate.split("/").filter(Boolean);
    if (
      reqParts.length === candParts.length &&
      reqParts.every((part, index) => part === ":param" || part === candParts[index])
    ) {
      return true;
    }
  }
  return false;
}

function checkClientContracts(openapi) {
  const clients = [
    { name: "admin", dir: path.join(root, "apps", "admin") },
    { name: "storefront", dir: path.join(root, "apps", "storefront") },
    { name: "mobile", dir: path.join(root, "apps", "mobile") },
    { name: "bot", dir: path.join(root, "apps", "bot") },
  ];

  const failures = [];

  for (const client of clients) {
    const paths = collectApiPathsFromCode(client.dir);
    for (const requestedPath of paths) {
      // Client apps may call their own Next.js route handlers (`/api/*`), which are outside apps/api OpenAPI.
      if (requestedPath.startsWith("/api/")) {
        continue;
      }
      if (!pathExists(openapi.paths, requestedPath)) {
        failures.push(`[${client.name}] endpoint not present in OpenAPI: ${requestedPath}`);
      }
    }
  }

  return failures;
}

function checkBreakingWithoutMajorBump() {
  const apiPackage = readJson(path.join(root, "apps", "api", "package.json"));
  const currentMajor = Number(String(apiPackage.version || "0.0.0").split(".")[0]);

  const baselinePath = path.join(root, "packages", "shared", "contracts", "openapi", "v1.baseline.json");
  const currentPath = path.join(root, "packages", "shared", "contracts", "openapi", "v1.json");

  if (!fs.existsSync(baselinePath) || !fs.existsSync(currentPath)) {
    return [];
  }

  const baseline = readJson(baselinePath);
  const current = readJson(currentPath);
  const baselineMajor = Number(
    String(baseline?.info?.version || "1")
      .replace(/^v/i, "")
      .split(".")[0],
  );

  const removed = [];
  for (const [pathKey, methods] of Object.entries(baseline.paths || {})) {
    if (!current.paths?.[pathKey]) {
      removed.push(`${pathKey} (all methods)`);
      continue;
    }
    for (const method of Object.keys(methods || {})) {
      if (!current.paths[pathKey]?.[method]) {
        removed.push(`${method.toUpperCase()} ${pathKey}`);
      }
    }
  }

  if (removed.length > 0 && currentMajor <= baselineMajor) {
    return removed.map((item) => `breaking change without major bump: removed ${item}`);
  }
  return [];
}

function parseCurrentEventModel() {
  const filePath = path.join(root, "packages", "shared", "src", "event-model.ts");
  const text = fs.readFileSync(filePath, "utf8");

  const eventNamesBlock = text.match(/EventNames\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const eventNames = [];
  if (eventNamesBlock) {
    const nameRegex = /"([^"]+)"/g;
    let n;
    while ((n = nameRegex.exec(eventNamesBlock[1]))) {
      eventNames.push(n[1]);
    }
  }

  const requiredFields = [];
  const envelopeBlock = text.match(/export type EventEnvelope\s*=\s*\{([\s\S]*?)\};/);
  if (envelopeBlock) {
    for (const rawLine of envelopeBlock[1].split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;
      const fieldMatch = line.match(/^([A-Za-z0-9_]+)(\?)?\s*:/);
      if (fieldMatch && fieldMatch[2] !== "?") {
        requiredFields.push(fieldMatch[1]);
      }
    }
  }

  return {
    schemaVersion: 1,
    eventNames,
    requiredEnvelopeFields: [...new Set(requiredFields)],
  };
}

function checkEventBackwardCompatibility() {
  const baselinePath = path.join(root, "packages", "shared", "contracts", "events", "v1.json");
  if (!fs.existsSync(baselinePath)) {
    return [];
  }

  const baseline = readJson(baselinePath);
  const current = parseCurrentEventModel();
  const failures = [];

  for (const name of baseline.eventNames || []) {
    if (!current.eventNames.includes(name)) {
      failures.push(`event removed from schema: ${name}`);
    }
  }

  for (const field of baseline.requiredEnvelopeFields || []) {
    if (!current.requiredEnvelopeFields.includes(field)) {
      failures.push(`required envelope field removed: ${field}`);
    }
  }

  if ((current.schemaVersion ?? 0) < (baseline.schemaVersion ?? 0)) {
    failures.push(`schemaVersion regressed: current=${current.schemaVersion} baseline=${baseline.schemaVersion}`);
  }

  return failures;
}

function main() {
  const openapiV1Path = path.join(root, "packages", "shared", "contracts", "openapi", "v1.json");
  if (!fs.existsSync(openapiV1Path)) {
    console.error("OpenAPI contract not found. Run: pnpm contract:generate");
    process.exit(1);
  }

  const openapi = readJson(openapiV1Path);
  const failures = [
    ...checkClientContracts(openapi),
    ...checkBreakingWithoutMajorBump(),
    ...checkEventBackwardCompatibility(),
  ];

  if (failures.length > 0) {
    console.error("Contract checks failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Contract checks passed.");
}

main();
