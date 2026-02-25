import test from "node:test";
import assert from "node:assert/strict";
import { adminSelfServeNav, pricingLegalCopy, pricingTierCards } from "./self-serve-ui-content";

test("admin self-serve UI snapshot basic and navigation", () => {
  assert.deepEqual(
    adminSelfServeNav,
    [
      { href: "/pricing", label: "Pricing" },
      { href: "/billing/manage", label: "Billing Manage" },
      { href: "/plan-billing", label: "Plan Billing (advanced)" },
    ],
  );
  assert.deepEqual(
    pricingTierCards.map((x) => ({ tier: x.tier, limits: x.limits.length, benefits: x.benefits.length, recommended: !!x.recommended })),
    [
      { tier: "C1", limits: 5, benefits: 4, recommended: false },
      { tier: "C2", limits: 5, benefits: 4, recommended: true },
      { tier: "C3", limits: 5, benefits: 4, recommended: false },
    ],
  );
  assert.equal(pricingLegalCopy.trialTerms.length >= 3, true);
  assert.equal(pricingLegalCopy.marketingConsent.length >= 2, true);
});

