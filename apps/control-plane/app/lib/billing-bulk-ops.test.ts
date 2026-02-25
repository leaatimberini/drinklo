import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBulkActionManifest,
  canApproveBulkAction,
  canRequestBulkAction,
  signBulkActionManifest,
  type BulkActionKind,
} from "./billing-bulk-ops";

test("permission matrix for bulk billing actions", () => {
  assert.equal(canRequestBulkAction("support", "SET_TIER"), true);
  assert.equal(canRequestBulkAction("support", "EXTEND_TRIAL"), true);
  assert.equal(canRequestBulkAction("support", "FRAUD_PAUSE"), false);
  assert.equal(canRequestBulkAction("ops", "FRAUD_PAUSE"), true);
  assert.equal(canRequestBulkAction("ops", "FRAUD_CANCEL"), true);
  assert.equal(canRequestBulkAction("admin", "FRAUD_CANCEL"), true);
});

test("two-person approval enforces different role and actor", () => {
  const actionType: BulkActionKind = "SET_TIER";
  const sameRole = canApproveBulkAction({
    role: "support",
    actionType,
    requestedByRole: "support",
    requestedByActor: "alice",
    approverActor: "bob",
    requiresTwoPersonApproval: true,
    existingApproverRoles: [],
  });
  assert.equal(sameRole.ok, false);
  if (!sameRole.ok) assert.equal(sameRole.reason, "second_approver_must_be_different_role");

  const sameActor = canApproveBulkAction({
    role: "ops",
    actionType,
    requestedByRole: "support",
    requestedByActor: "alice",
    approverActor: "alice",
    requiresTwoPersonApproval: true,
    existingApproverRoles: [],
  });
  assert.equal(sameActor.ok, false);
  if (!sameActor.ok) assert.equal(sameActor.reason, "second_approver_must_be_different_actor");

  const valid = canApproveBulkAction({
    role: "ops",
    actionType,
    requestedByRole: "support",
    requestedByActor: "alice",
    approverActor: "bob",
    requiresTwoPersonApproval: true,
    existingApproverRoles: [],
  });
  assert.equal(valid.ok, true);
});

test("manifest hash/signature is deterministic and tamper-evident", () => {
  const manifest = buildBulkActionManifest({
    actionType: "EXTEND_TRIAL",
    instanceIds: ["inst-b", "inst-a"],
    campaignId: "camp-1",
    targetTier: null,
    trialExtensionDays: 7,
    reason: "retention campaign",
    requestedByRole: "support",
    requestedByActor: "alice",
    approvalsNeeded: 2,
    requiresTwoPersonApproval: true,
  });
  const signed1 = signBulkActionManifest(manifest);
  const signed2 = signBulkActionManifest({ ...manifest });
  assert.equal(signed1.manifestHash, signed2.manifestHash);
  assert.equal(signed1.evidenceSignature, signed2.evidenceSignature);

  const tampered = signBulkActionManifest({ ...manifest, trialExtensionDays: 8 });
  assert.notEqual(tampered.manifestHash, signed1.manifestHash);
  assert.notEqual(tampered.evidenceSignature, signed1.evidenceSignature);
});

