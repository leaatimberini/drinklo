import crypto from "node:crypto";
import fs from "node:fs";

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const version = getArg("--version");
const sha = getArg("--sha");
const channel = getArg("--channel");
const migrationsRequired = getArg("--migrations-required", "false") === "true";
const breakingChanges = getArg("--breaking-changes", "");
const outPath = getArg("--out");
const secret = process.env.RELEASE_SIGNING_SECRET ?? "";

if (!version || !sha || !channel || !secret) {
  // eslint-disable-next-line no-console
  console.error("Usage: --version x.y.z --sha <commit> --channel <stable|beta> --migrations-required true|false --breaking-changes \"...\" --out path");
  process.exit(1);
}

const payload = {
  version,
  sha,
  channel,
  migrations_required: migrationsRequired,
  breaking_changes: breakingChanges || null,
  released_at: new Date().toISOString(),
};

const signature = crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
const manifest = { ...payload, signature };
const output = JSON.stringify(manifest, null, 2);

if (outPath) {
  fs.writeFileSync(outPath, `${output}\n`, "utf8");
} else {
  // eslint-disable-next-line no-console
  console.log(output);
}
