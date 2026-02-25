import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_CERT_KIT_VERSION,
  computePartnerCertificationExpiry,
  resolvePartnerCertificationStatus,
  signCertificationReport,
  validatePartnerCertificationReport,
  verifyCertificationReportSignature,
} from "./partner-certification";

function validReport() {
  return {
    kitVersion: PARTNER_CERT_KIT_VERSION,
    executedAt: "2026-02-25T18:30:00.000Z",
    openapi: { passed: true, testsRun: 12, failures: 0 },
    events: { passed: true, schemasChecked: 6, incompatibleSchemas: 0 },
    sandbox: { passed: true, scenariosRun: 3, failedScenarios: 0 },
    security: {
      checklist: [
        { id: "webhook-signature-validation", passed: true },
        { id: "idempotency-handling", passed: true },
        { id: "secret-storage-rotation", passed: true },
        { id: "least-privilege-scopes", passed: true },
        { id: "audit-logging-enabled", passed: true },
      ],
    },
    performance: {
      p95ApiMs: 400,
      p95WebhookProcessingMs: 900,
      checklist: [
        { id: "p95-api-under-500ms", passed: true },
        { id: "p95-webhook-processing-under-1000ms", passed: true },
        { id: "retry-backoff-implemented", passed: true },
        { id: "dlq-observable", passed: true },
      ],
    },
  };
}

test("validates signed partner certification report", () => {
  const report = validReport();
  const token = "portal-secret-token";
  const signature = signCertificationReport(report, token);

  assert.equal(verifyCertificationReportSignature(report, signature, token), true);
  assert.equal(verifyCertificationReportSignature(report, signature, "wrong-token"), false);

  const validation = validatePartnerCertificationReport(report);
  assert.equal(validation.passed, true);
  assert.equal(validation.score, 100);
});

test("fails validation when required checks are missing", () => {
  const report = validReport();
  report.performance.p95ApiMs = 700;
  report.security.checklist = report.security.checklist.filter((x) => x.id !== "audit-logging-enabled");

  const validation = validatePartnerCertificationReport(report);
  assert.equal(validation.passed, false);
  assert.ok(validation.errors.some((e) => e.includes("security checklist")));
  assert.ok(validation.errors.some((e) => e.includes("performance thresholds")));
});

test("certification expiration resolves correctly", () => {
  const issuedAt = new Date("2026-01-01T00:00:00.000Z");
  const expiresAt = computePartnerCertificationExpiry(issuedAt, 30);
  assert.equal(expiresAt.toISOString().slice(0, 10), "2026-01-31");

  assert.equal(
    resolvePartnerCertificationStatus({
      status: "ACTIVE",
      expiresAt,
      now: new Date("2026-01-15T00:00:00.000Z"),
    }),
    "ACTIVE",
  );
  assert.equal(
    resolvePartnerCertificationStatus({
      status: "ACTIVE",
      expiresAt,
      now: new Date("2026-02-01T00:00:00.000Z"),
    }),
    "EXPIRED",
  );
  assert.equal(
    resolvePartnerCertificationStatus({
      status: "REVOKED",
      expiresAt,
      now: new Date("2026-01-15T00:00:00.000Z"),
    }),
    "REVOKED",
  );
});

