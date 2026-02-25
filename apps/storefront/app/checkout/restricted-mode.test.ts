import test from "node:test";
import assert from "node:assert/strict";
import { isCheckoutBlockedByRestrictedMode, parseRestrictedCheckoutError } from "./restricted-mode";

test("catalog-only restricted mode blocks checkout", () => {
  assert.equal(
    isCheckoutBlockedByRestrictedMode({
      enabled: true,
      variant: "CATALOG_ONLY",
      storefrontCheckoutBlocked: true,
    }),
    true,
  );
  assert.equal(
    isCheckoutBlockedByRestrictedMode({
      enabled: true,
      variant: "ALLOW_BASIC_SALES",
      storefrontCheckoutBlocked: false,
    }),
    false,
  );
});

test("parses restricted checkout API error for coherent UX", () => {
  const parsed = parseRestrictedCheckoutError({
    code: "SUBSCRIPTION_RESTRICTED",
    message: "Checkout deshabilitado",
    cta: { label: "Actualizar plan" },
  });
  assert.deepEqual(parsed, { message: "Checkout deshabilitado", ctaLabel: "Actualizar plan" });
  assert.equal(parseRestrictedCheckoutError({ code: "OTHER" }), null);
});

