#!/usr/bin/env node
import fs from "node:fs";
import { buildSarif, extractFindingsFromZapJson, loadZapReport } from "./zap-report-utils.mjs";

function main() {
  const input = process.env.ZAP_JSON_FILES ?? "zap-api.json,zap-admin.json,zap-storefront.json";
  const output = process.env.ZAP_SARIF_OUT ?? "zap-results.sarif";

  const files = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const findings = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const report = loadZapReport(file);
    findings.push(...extractFindingsFromZapJson(report));
  }

  const sarif = buildSarif(findings);
  fs.writeFileSync(output, `${JSON.stringify(sarif, null, 2)}\n`, "utf8");
  console.log(`SARIF generated: ${output} findings=${findings.length}`);
}

main();
