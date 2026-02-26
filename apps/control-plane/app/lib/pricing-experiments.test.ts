import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPercentOffOffer,
  buildOfferGrantFromVariant,
  buildPricingExperimentStickySeed,
  canApplyOffer,
  parseVariantConfig,
  pickWeightedVariant,
} from "./pricing-experiments";

test("stable assignment picks same variant for same cookie+domain seed", () => {
  const seedA = buildPricingExperimentStickySeed({
    experimentKey: "c1-offer-test",
    cookieId: "cookie-123",
    emailDomain: "demo.com",
    trialCode: "PROMO30",
  });
  const seedB = buildPricingExperimentStickySeed({
    experimentKey: "c1-offer-test",
    cookieId: "cookie-123",
    emailDomain: "demo.com",
    trialCode: "PROMO30",
  });
  assert.equal(seedA, seedB);
  const variants = [
    { key: "control", weight: 50 },
    { key: "offer20", weight: 50 },
  ];
  const pick1 = pickWeightedVariant(variants, String(seedA));
  const pick2 = pickWeightedVariant(variants, String(seedB));
  assert.equal(pick1.key, pick2.key);
});

test("offer expires after configured window", () => {
  const cfg = parseVariantConfig({ offer: { percentOff: 20, billingCycles: 3, expiresDays: 10 } });
  const assignedAt = new Date("2026-02-01T00:00:00.000Z");
  const grant = buildOfferGrantFromVariant(cfg, assignedAt);
  assert.ok(grant);
  const before = canApplyOffer({ ...grant, offerMeta: grant?.offerMeta }, new Date("2026-02-05T00:00:00.000Z"));
  assert.equal(before.ok, true);
  const after = canApplyOffer({ ...grant, offerMeta: grant?.offerMeta }, new Date("2026-02-12T00:00:00.000Z"));
  assert.equal(after.ok, false);
  if (!after.ok) assert.equal(after.reason, "offer_expired");
});

test("no abuse: exhausted cycles cannot be applied again", () => {
  const cfg = parseVariantConfig({ offer: { percentOff: 20, billingCycles: 1, expiresDays: 30 } });
  const grant = buildOfferGrantFromVariant(cfg, new Date("2026-02-01T00:00:00.000Z"));
  assert.ok(grant);
  const applied = applyPercentOffOffer({ baseAmount: 100, percentOff: 20 });
  assert.equal(applied.finalAmount, 80);
  const exhaustedCheck = canApplyOffer(
    {
      ...grant,
      offerMeta: grant?.offerMeta,
      offerConsumedCycles: 1,
      offerMaxCycles: 1,
      offerStatus: "GRANTED",
    },
    new Date("2026-02-02T00:00:00.000Z"),
  );
  assert.equal(exhaustedCheck.ok, false);
  if (!exhaustedCheck.ok) assert.equal(exhaustedCheck.reason, "offer_cycles_exhausted");
});
