import test from "node:test";
import assert from "node:assert/strict";
import { runPluginReview } from "./plugin-review";
import {
  buildInstallJobFromRequest,
  buildReleaseDataFromSubmission,
  computeCertification,
  ensureSubmissionCanBeApproved,
} from "./plugin-marketplace-public";

test("publish -> review -> approve -> install flow", () => {
  const reviewReport = runPluginReview({
    pluginName: "promo-rule",
    version: "1.2.3",
    channel: "stable",
    bundleUrl: "https://plugins.example.com/promo-rule-1.2.3.tgz",
    manifest: {
      hooks: ["onOrderCreated"],
      permissionsUsed: ["products:read", "plugins:execute"],
    },
    requestedPermissions: ["products:read", "plugins:execute"],
    dependencies: ["zod@3.0.0"],
  });

  const guard = ensureSubmissionCanBeApproved(reviewReport);
  assert.equal(guard.ok, true);

  const releaseData = buildReleaseDataFromSubmission({
    id: "sub_1",
    publisherId: "pub_1",
    pluginName: "promo-rule",
    version: "1.2.3",
    channel: "stable",
    compatibility: "0.1.x,0.2.x",
    compatibilityMatrix: [{ platformVersion: "0.1.x", status: "supported" }],
    changelog: "Added promo engine",
    signature: "sig",
    requestedPermissions: ["products:read", "plugins:execute"],
    dependencies: ["zod@3.0.0"],
    publisher: { verificationStatus: "VERIFIED" },
    reviewReport,
  });

  assert.equal(releaseData.certified, true);
  assert.equal(releaseData.reviewStatus, "approved");

  const installJob = buildInstallJobFromRequest({
    installationId: "inst_1",
    request: {
      id: "req_1",
      instanceId: "instance_1",
      pluginName: "promo-rule",
      version: "1.2.3",
      action: "install",
    },
    compatible: true,
  });

  assert.equal(installJob.status, "pending");
  assert.equal(installJob.pluginName, "promo-rule");
});

test("rejects when plugin uses permission not requested", () => {
  const reviewReport = runPluginReview({
    pluginName: "dangerous-plugin",
    version: "1.0.0",
    channel: "stable",
    bundleUrl: "https://plugins.example.com/dangerous.tgz",
    manifest: {
      permissionsUsed: ["products:read", "pricing:write"],
    },
    requestedPermissions: ["products:read"],
    dependencies: ["zod@3.0.0"],
  });

  assert.equal(reviewReport.policyChecks.status, "fail");
  assert.equal(reviewReport.staticAnalysis.status, "fail");
  assert.deepEqual(reviewReport.staticAnalysis.undeclaredUsedPermissions, ["pricing:write"]);
  assert.equal(ensureSubmissionCanBeApproved(reviewReport).ok, false);
});

test("certification badge requires stable + verified publisher + passed battery", () => {
  const reviewReport = runPluginReview({
    pluginName: "inventory-widget",
    version: "1.0.0",
    channel: "beta",
    bundleUrl: "https://plugins.example.com/inventory-widget.tgz",
    manifest: { permissionsUsed: ["inventory:read"] },
    requestedPermissions: ["inventory:read"],
    dependencies: ["zod@3.0.0"],
  });

  const betaCertified = computeCertification(reviewReport, "beta", true);
  const stableUnverified = computeCertification(reviewReport, "stable", false);
  const stableVerified = computeCertification(reviewReport, "stable", true);

  assert.equal(betaCertified.certified, false);
  assert.equal(stableUnverified.certified, false);
  assert.equal(stableVerified.certified, true);
});

