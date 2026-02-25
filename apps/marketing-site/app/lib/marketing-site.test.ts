import test from "node:test";
import assert from "node:assert/strict";
import {
  buildControlPlaneUrl,
  buildLeadPayload,
  buildTrialSignupHref,
  extractUtmFromSearchParams,
  normalizeBusinessType,
} from "./marketing-site";

test("builds signup href with optional normalized trial code", () => {
  assert.equal(buildTrialSignupHref(null), "/signup");
  assert.equal(buildTrialSignupHref(" abc123 "), "/signup?trial=ABC123");
});

test("extracts utm parameters and referral from search params", () => {
  const params = new URLSearchParams("utm_source=google&utm_campaign=q1&utm_medium=cpc&ref=partner");
  const utm = extractUtmFromSearchParams(params);
  assert.equal(utm.utmSource, "google");
  assert.equal(utm.utmCampaign, "q1");
  assert.equal(utm.utmMedium, "cpc");
  assert.equal(utm.referral, "partner");
});

test("builds lead payload and normalizes fields", () => {
  const payload = buildLeadPayload({
    email: " TEST@MAIL.COM ",
    businessType: "BAR",
    city: "CABA",
    trial: "launch30",
    utm: { utmSource: " meta ", referral: " affiliate-1 " },
  });
  assert.equal(payload.email, "test@mail.com");
  assert.equal(payload.businessType, "bar");
  assert.equal(payload.trial, "LAUNCH30");
  assert.equal(payload.utmSource, "meta");
  assert.equal(payload.referral, "affiliate-1");
});

test("normalize business type defaults to kiosco", () => {
  assert.equal(normalizeBusinessType("retail"), "kiosco");
  assert.equal(normalizeBusinessType("distribuidora"), "distribuidora");
});

test("build control plane url uses env and trims slashes", () => {
  const prev = process.env.CONTROL_PLANE_URL;
  process.env.CONTROL_PLANE_URL = "http://localhost:3010/";
  assert.equal(buildControlPlaneUrl("/api/pricing-catalog/public"), "http://localhost:3010/api/pricing-catalog/public");
  process.env.CONTROL_PLANE_URL = prev;
});

