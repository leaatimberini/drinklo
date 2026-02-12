import fs from "node:fs";
import path from "node:path";

function normalizeSeverity(alert) {
  const riskCode = Number(alert.riskcode);
  if (riskCode >= 3) return "high";
  if (riskCode === 2) return "medium";
  if (riskCode === 1) return "low";
  return "info";
}

function parseUri(uri) {
  try {
    const parsed = new URL(uri);
    return { target: `${parsed.protocol}//${parsed.host}`, route: parsed.pathname || "/" };
  } catch {
    return { target: "", route: uri || "/" };
  }
}

export function extractFindingsFromZapJson(reportJson) {
  const findings = [];
  const sites = Array.isArray(reportJson?.site) ? reportJson.site : [];

  for (const site of sites) {
    const alerts = Array.isArray(site?.alerts) ? site.alerts : [];
    for (const alert of alerts) {
      const severity = normalizeSeverity(alert);
      const instances = Array.isArray(alert.instances) ? alert.instances : [];
      if (instances.length === 0) {
        findings.push({
          target: String(site?.["@name"] ?? "unknown"),
          route: "/",
          ruleId: String(alert.pluginid ?? alert.alertRef ?? "unknown"),
          title: String(alert.alert ?? "Unknown alert"),
          severity,
          evidence: null,
          recommendation: alert.solution ? String(alert.solution) : null,
          metadata: {
            riskDesc: alert.riskdesc ?? null,
            description: alert.desc ?? null,
            cweId: alert.cweid ?? null,
            wascId: alert.wascid ?? null,
            method: null,
            param: null,
          },
        });
        continue;
      }

      for (const instance of instances) {
        const uri = String(instance.uri ?? "");
        const parsed = parseUri(uri);
        findings.push({
          target: parsed.target || String(site?.["@name"] ?? "unknown"),
          route: parsed.route,
          ruleId: String(alert.pluginid ?? alert.alertRef ?? "unknown"),
          title: String(alert.alert ?? "Unknown alert"),
          severity,
          evidence: instance.evidence ? String(instance.evidence) : null,
          recommendation: alert.solution ? String(alert.solution) : null,
          metadata: {
            riskDesc: alert.riskdesc ?? null,
            description: alert.desc ?? null,
            cweId: alert.cweid ?? null,
            wascId: alert.wascid ?? null,
            method: instance.method ?? null,
            param: instance.param ?? null,
          },
        });
      }
    }
  }

  return findings;
}

function sarifLevel(severity) {
  const lower = String(severity).toLowerCase();
  if (lower === "high") return "error";
  if (lower === "medium") return "warning";
  return "note";
}

export function buildSarif(findings) {
  const rulesMap = new Map();
  for (const finding of findings) {
    if (!rulesMap.has(finding.ruleId)) {
      rulesMap.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.title,
        shortDescription: { text: finding.title },
        fullDescription: { text: finding.metadata?.description ?? finding.title },
        properties: {
          tags: ["security", "dast", "owasp-zap"],
          severity: finding.severity,
        },
      });
    }
  }

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "OWASP ZAP Baseline",
            informationUri: "https://www.zaproxy.org/docs/docker/baseline-scan/",
            rules: Array.from(rulesMap.values()),
          },
        },
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding.severity),
          message: {
            text: `${finding.title} (${finding.severity})`,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: `${finding.target}${finding.route}`,
                },
              },
            },
          ],
          properties: {
            severity: finding.severity,
            evidence: finding.evidence,
            recommendation: finding.recommendation,
            metadata: finding.metadata ?? null,
          },
        })),
      },
    ],
  };
}

export function loadZapReport(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}
