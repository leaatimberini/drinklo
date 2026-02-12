#!/usr/bin/env node
import fs from "node:fs";
import { extractFindingsFromZapJson, loadZapReport } from "./zap-report-utils.mjs";

async function main() {
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
  const token = process.env.CONTROL_PLANE_SECURITY_TOKEN;
  if (!controlPlaneUrl || !token) {
    console.log("ingest-dast: CONTROL_PLANE_URL or CONTROL_PLANE_SECURITY_TOKEN missing");
    return;
  }

  const input = process.env.ZAP_JSON_FILES ?? "zap-api.json,zap-admin.json,zap-storefront.json";
  const files = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((file) => fs.existsSync(file));

  const findings = [];
  for (const file of files) {
    const report = loadZapReport(file);
    findings.push(...extractFindingsFromZapJson(report));
  }

  const payload = {
    instanceId: process.env.SECURITY_REPORT_INSTANCE_ID ?? null,
    repo: process.env.SECURITY_REPORT_REPO ?? null,
    sha: process.env.SECURITY_REPORT_SHA ?? null,
    runId: process.env.SECURITY_REPORT_RUN_ID ?? null,
    status: process.env.SECURITY_REPORT_STATUS ?? "completed",
    summary: {
      total: findings.length,
      bySeverity: findings.reduce((acc, item) => {
        acc[item.severity] = (acc[item.severity] ?? 0) + 1;
        return acc;
      }, {}),
    },
    findings,
  };

  const res = await fetch(`${controlPlaneUrl.replace(/\/$/, "")}/api/security-report/dast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-security-token": token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("ingest-dast failed", res.status, text);
    process.exit(1);
  }

  const response = await res.json().catch(() => ({}));
  console.log("ingest-dast ok", response);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
