import assert from "node:assert/strict";
import test from "node:test";
import { signEnterpriseSecurityPack, verifyEnterpriseSecurityPackSignature } from "./enterprise-security-pack";

test("security pack manifest signature is valid and detects tampering", () => {
  const payload = {
    generatedAt: "2026-02-26T12:00:00.000Z",
    installation: {
      installationId: "inst-1",
      instanceId: "demo-001",
      clientName: "Demo",
      domain: "demo.local",
      version: "1.0.0",
      releaseChannel: "stable",
      healthStatus: "ok",
    },
    iam: { ssoEnabled: true, mfaEnforced: true, scimEnabled: false, lastSyncAt: null },
    slos: { p95Ms: 120, errorRate: 0.01, webhookRetryRate: 0.001, measuredAt: "2026-02-26T10:00:00.000Z" },
    backups: {
      latestBackupAt: "2026-02-26T03:00:00.000Z",
      latestBackupStatus: "ok",
      recent30dCount: 30,
      lastRestoreVerification: { status: "ok", environment: "staging", finishedAt: "2026-02-25T06:00:00.000Z" },
      restoreVerifications30d: 4,
    },
    disasterRecovery: {
      lastDrillAt: "2026-02-20T10:00:00.000Z",
      lastDrillStatus: "ok",
      lastDrillRpoMinutes: 15,
      lastDrillRtoMinutes: 42,
      drills90d: 6,
    },
    audit: {
      complianceEvidenceCount: 50,
      recentEvidence: [],
      sodAccessReviewLatest: { capturedAt: null, activePolicies: 0, violations24h: 0, openCampaigns: 0, overdueCampaigns: 0 },
      legalAcceptancesCount: 2,
      latestLegalAcceptances: [],
    },
    sbom: { latestReports: [], latestAt: null, reportCount90d: 2 },
    dast: { latestReports: [], findingsOpenBySeverity: { high: 1 }, latestAt: null, findingsTotal: 1 },
    accessibility: { latestReport: { version: "1.0.0", score: 95, criticalViolations: 0, seriousViolations: 1, totalViolations: 2, measuredAt: null } },
    policies: { complianceControls: [], legalDocuments: [] },
    evidenceManifest: {
      sectionHashes: {
        installation: "a",
        iam: "b",
        slos: "c",
        backups: "d",
        disasterRecovery: "e",
        audit: "f",
        sbom: "g",
        dast: "h",
        accessibility: "i",
        policies: "j",
      },
      payloadHash: "hash-1",
    },
  } as any;

  const bundle = signEnterpriseSecurityPack(payload, {
    zipHash: "ziphash",
    pdfHash: "pdfhash",
    secret: "test-secret",
  });
  assert.equal(verifyEnterpriseSecurityPackSignature(bundle, "test-secret"), true);

  const tampered = {
    ...bundle,
    manifest: {
      ...bundle.manifest,
      sectionHashes: { ...bundle.manifest.sectionHashes, iam: "tampered" },
    },
  };
  assert.equal(verifyEnterpriseSecurityPackSignature(tampered, "test-secret"), false);
});

