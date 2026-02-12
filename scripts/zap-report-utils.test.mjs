import assert from "node:assert/strict";
import test from "node:test";
import { extractFindingsFromZapJson, buildSarif } from "./zap-report-utils.mjs";

test("parse zap json report and build sarif", () => {
  const report = {
    site: [
      {
        "@name": "https://storefront.staging.example.com",
        alerts: [
          {
            pluginid: "10021",
            alert: "X-Content-Type-Options Header Missing",
            riskcode: "1",
            riskdesc: "Low (Medium)",
            desc: "Header missing",
            solution: "Set header",
            instances: [
              {
                uri: "https://storefront.staging.example.com/products/1",
                method: "GET",
                evidence: "",
              },
            ],
          },
        ],
      },
    ],
  };

  const findings = extractFindingsFromZapJson(report);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "low");
  assert.equal(findings[0].route, "/products/1");

  const sarif = buildSarif(findings);
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].results.length, 1);
  assert.equal(sarif.runs[0].results[0].ruleId, "10021");
});
