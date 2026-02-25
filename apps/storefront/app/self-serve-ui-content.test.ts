import test from "node:test";
import assert from "node:assert/strict";
import { pricingLegalCopy, pricingTierCards, storefrontSelfServeNav } from "./self-serve-ui-content";

test("storefront self-serve UI snapshot basic and navigation", () => {
  assert.deepEqual(
    storefrontSelfServeNav,
    [
      { href: "/pricing", label: "Pricing" },
      { href: "/billing/manage", label: "Billing Manage" },
      { href: "/", label: "Catalogo" },
    ],
  );
  assert.deepEqual(pricingTierCards.map((x) => x.tier), ["C1", "C2", "C3"]);
  assert.equal(pricingTierCards.some((x) => x.recommended), true);
  assert.equal(pricingLegalCopy.graceRestricted.some((line) => line.includes("no borra datos")), true);
});

