#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const portalDir = path.join(root, "apps", "control-plane", "app", "developer-portal");
const publicDir = path.join(root, "apps", "control-plane", "public");

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx|md)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function routeExists(routePath) {
  if (routePath === "/developer-portal") {
    return fs.existsSync(path.join(portalDir, "page.tsx"));
  }
  const relative = routePath.replace(/^\/developer-portal\/?/, "");
  return fs.existsSync(path.join(portalDir, relative, "page.tsx"));
}

function assetExists(assetPath) {
  return fs.existsSync(path.join(publicDir, assetPath.replace(/^\//, "")));
}

function collectLinks(text) {
  const links = [];
  const hrefRegex = /href=\"([^\"]+)\"/g;
  let match;
  while ((match = hrefRegex.exec(text))) {
    links.push(match[1]);
  }

  const mdRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  while ((match = mdRegex.exec(text))) {
    links.push(match[1]);
  }

  return links;
}

function main() {
  const files = walk(portalDir);
  const failures = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const links = collectLinks(text);

    for (const link of links) {
      if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("mailto:")) {
        continue;
      }
      if (link.startsWith("#")) {
        continue;
      }
      if (link.startsWith("/developer-portal")) {
        if (!routeExists(link.split("?")[0])) {
          failures.push(`${path.relative(root, file)} -> missing route ${link}`);
        }
        continue;
      }
      if (link.startsWith("/developer-api/")) {
        if (!assetExists(link)) {
          failures.push(`${path.relative(root, file)} -> missing asset ${link}`);
        }
        continue;
      }
    }
  }

  if (failures.length > 0) {
    console.error("Developer portal link validation failed:");
    for (const item of failures) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log(`Developer portal link validation passed (${files.length} files).`);
}

main();
