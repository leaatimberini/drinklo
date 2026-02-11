import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const secret = process.env.PLUGIN_SIGNING_SECRET ?? "";
const pluginName = process.argv[2];

if (!secret || !pluginName) {
  console.error("Usage: PLUGIN_SIGNING_SECRET=... node scripts/sign-plugin.mjs <plugin-name>");
  process.exit(1);
}

const manifestPath = path.join("packages", "plugins", pluginName, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("Manifest not found:", manifestPath);
  process.exit(1);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
delete manifest.signature;
const signature = crypto.createHmac("sha256", secret).update(stableStringify(manifest)).digest("hex");

const updated = { ...manifest, signature };
fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
console.log(`Signed ${pluginName}`);
