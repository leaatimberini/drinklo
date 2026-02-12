#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const docPath = path.join(root, "packages", "docs", "DEVELOPER_PORTAL.md");

function main() {
  if (!fs.existsSync(docPath)) {
    console.error("Missing packages/docs/DEVELOPER_PORTAL.md");
    process.exit(1);
  }

  const text = fs.readFileSync(docPath, "utf8");
  const required = [
    "## ES",
    "## EN",
    "Developer Portal",
    "OpenAPI",
    "changelog",
    "redoc",
    "build",
    "links",
  ];

  const failures = [];
  for (const item of required) {
    if (!text.toLowerCase().includes(item.toLowerCase())) {
      failures.push(`missing section/token: ${item}`);
    }
  }

  const trailingWhitespace = text
    .split(/\r?\n/)
    .map((line, idx) => ({ idx: idx + 1, line }))
    .filter(({ line }) => /\s+$/.test(line));

  if (trailingWhitespace.length > 0) {
    failures.push(`trailing whitespace lines: ${trailingWhitespace.map((x) => x.idx).join(", ")}`);
  }

  if (failures.length > 0) {
    console.error("Developer portal docs lint failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Developer portal docs lint passed.");
}

main();
