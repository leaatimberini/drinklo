import assert from "node:assert/strict";
import test from "node:test";
import { assertDemoResetAllowed, buildDemoResetEvidencePayload, isDemoResetEligibleInstallation } from "./demo-mode";

test("demo reset eligibility matches demo/sandbox hints", () => {
  assert.equal(isDemoResetEligibleInstallation({ instanceId: "demo-001" }), true);
  assert.equal(isDemoResetEligibleInstallation({ domain: "sandbox.customer.local" }), true);
  assert.equal(isDemoResetEligibleInstallation({ clientName: "ACME Demo" }), true);
  assert.equal(isDemoResetEligibleInstallation({ releaseChannel: "demo" }), true);
  assert.equal(isDemoResetEligibleInstallation({ instanceId: "prod-001", domain: "store.customer.com" }), false);
});

test("demo reset requires explicit confirmation and demo target", () => {
  assert.throws(
    () => assertDemoResetAllowed({ target: { instanceId: "demo-001" }, confirmText: "RESET" }),
    /confirmation_text_invalid/,
  );
  assert.throws(
    () => assertDemoResetAllowed({ target: { instanceId: "prod-001" }, confirmText: "RESET DEMO" }),
    /installation_not_demo_eligible/,
  );
  assert.equal(assertDemoResetAllowed({ target: { instanceId: "demo-001" }, confirmText: "RESET DEMO" }), true);
});

test("demo reset evidence payload hash is deterministic for same content", () => {
  const a = buildDemoResetEvidencePayload({
    actor: "cp:ops",
    target: { instanceId: "demo-001", domain: "demo.local" },
    endpoint: "https://demo.local/admin/sandbox/demo-reset",
    responseStatus: 200,
    responsePayload: { ok: true, snapshotApplied: "demo-bebidas-v1" },
    createdAt: "2026-02-26T12:00:00.000Z",
  });
  const b = buildDemoResetEvidencePayload({
    actor: "cp:ops",
    target: { instanceId: "demo-001", domain: "demo.local" },
    endpoint: "https://demo.local/admin/sandbox/demo-reset",
    responseStatus: 200,
    responsePayload: { ok: true, snapshotApplied: "demo-bebidas-v1" },
    createdAt: "2026-02-26T12:00:00.000Z",
  });

  assert.equal(a.payloadHash, b.payloadHash);
  assert.equal(a.payload.kind, "demo_reset");
});
