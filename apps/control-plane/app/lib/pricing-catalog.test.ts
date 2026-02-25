import test from "node:test";
import assert from "node:assert/strict";
import { buildPricingChangeImpact, resolveCurrentAndNextPlanPrice } from "./pricing-catalog";

test("resolves current and next price by effective dates", () => {
  const at = new Date("2026-03-10T12:00:00.000Z");
  const rows = [
    {
      id: "old",
      tier: "C1",
      billingPeriod: "MONTHLY" as const,
      currency: "USD",
      amount: 10,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-03-01T00:00:00.000Z"),
    },
    {
      id: "current",
      tier: "C1",
      billingPeriod: "MONTHLY" as const,
      currency: "USD",
      amount: 12,
      effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
      effectiveTo: null,
    },
    {
      id: "next",
      tier: "C1",
      billingPeriod: "MONTHLY" as const,
      currency: "USD",
      amount: 14,
      effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
      effectiveTo: null,
    },
  ];

  const resolved = resolveCurrentAndNextPlanPrice(rows as any, at);
  assert.equal(resolved.current?.id, "current");
  assert.equal(resolved.current?.amount, 12);
  assert.equal(resolved.next?.id, "next");
  assert.equal(resolved.next?.amount, 14);
});

test("pricing catalog changes are catalog-only by default (no subscription impact without explicit policy)", () => {
  const impact = buildPricingChangeImpact({});
  assert.equal(impact.affectsExistingSubscriptions, false);
  assert.equal(impact.policy, "CATALOG_ONLY");
});

test("explicit propagation policy is opt-in", () => {
  const impact = buildPricingChangeImpact({ propagateToExistingSubscriptions: true, applyToRenewalsOnly: true });
  assert.equal(impact.affectsExistingSubscriptions, true);
  assert.equal(impact.policy, "RENEWALS_ONLY");
});

