import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTrialCampaignEligibility } from "./trial-campaigns";

const baseCampaign = {
  code: "TRIAL30",
  tier: "C1" as const,
  durationDays: 30,
  maxRedemptions: 2,
  expiresAt: null,
  requiresApproval: false,
  allowedDomains: [],
  blockedDomains: [],
  status: "ACTIVE" as const,
};

test("trial campaign blocks when maxRedemptions reached", () => {
  const decision = evaluateTrialCampaignEligibility({
    now: new Date("2026-02-25T12:00:00Z"),
    campaign: baseCampaign,
    redeemedCount: 2,
    emailDomain: "example.com",
    fingerprintHash: "fp1",
    existingByDomain: 0,
    existingByFingerprint: 0,
    recentAttemptsFromIp: 0,
  });
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.reason, "max_redemptions_reached");
});

test("trial campaign expires and rejects redemption", () => {
  const decision = evaluateTrialCampaignEligibility({
    now: new Date("2026-02-25T12:00:00Z"),
    campaign: {
      ...baseCampaign,
      maxRedemptions: null,
      expiresAt: new Date("2026-02-25T11:59:59Z"),
    },
    redeemedCount: 0,
    emailDomain: "example.com",
    fingerprintHash: "fp1",
    existingByDomain: 0,
    existingByFingerprint: 0,
    recentAttemptsFromIp: 0,
  });
  assert.equal(decision.ok, false);
  if (decision.ok) return;
  assert.equal(decision.status, "EXPIRED");
  assert.equal(decision.reason, "campaign_expired");
});

test("anti-abuse blocks duplicate domain and rate-limited ip", () => {
  const duplicateDomain = evaluateTrialCampaignEligibility({
    now: new Date("2026-02-25T12:00:00Z"),
    campaign: { ...baseCampaign, maxRedemptions: null },
    redeemedCount: 0,
    emailDomain: "foo.com",
    fingerprintHash: "fp1",
    existingByDomain: 1,
    existingByFingerprint: 0,
    recentAttemptsFromIp: 0,
  });
  assert.equal(duplicateDomain.ok, false);
  if (!duplicateDomain.ok) {
    assert.equal(duplicateDomain.reason, "domain_already_used_trial");
  }

  const rateLimited = evaluateTrialCampaignEligibility({
    now: new Date("2026-02-25T12:00:00Z"),
    campaign: { ...baseCampaign, maxRedemptions: null },
    redeemedCount: 0,
    emailDomain: "bar.com",
    fingerprintHash: "fp2",
    existingByDomain: 0,
    existingByFingerprint: 0,
    recentAttemptsFromIp: 5,
    maxAttemptsPerHour: 5,
  });
  assert.equal(rateLimited.ok, false);
  if (!rateLimited.ok) {
    assert.equal(rateLimited.reason, "rate_limited_ip");
  }
});

