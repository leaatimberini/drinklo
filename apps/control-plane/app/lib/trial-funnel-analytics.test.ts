import test from "node:test";
import assert from "node:assert/strict";
import { aggregateTrialFunnelAnalytics, type TrialAnalyticsEventRow, type TrialAnalyticsLeadRow } from "./trial-funnel-analytics";

test("aggregates funnel, cohorts and ICP deterministically", () => {
  const leads: TrialAnalyticsLeadRow[] = [
    { createdAt: new Date("2026-02-01T12:00:00Z"), campaignId: "c1", campaignCode: "CAMPA", campaignTier: "C1", businessType: "kiosco" },
    { createdAt: new Date("2026-02-01T12:05:00Z"), campaignId: "c1", campaignCode: "CAMPA", campaignTier: "C1", businessType: "kiosco" },
    { createdAt: new Date("2026-02-02T12:00:00Z"), campaignId: "c2", campaignCode: "CAMPB", campaignTier: "C2", businessType: "distribuidora" },
  ];

  const events: TrialAnalyticsEventRow[] = [
    { eventType: "TrialStarted", eventAt: new Date("2026-02-01T12:10:00Z"), campaignId: "c1", campaignCode: "CAMPA", campaignTier: "C1", billingAccountId: "a1", businessType: "kiosco" },
    { eventType: "PaymentMethodAdded", eventAt: new Date("2026-02-02T12:10:00Z"), campaignId: "c1", campaignCode: "CAMPA", campaignTier: "C1", billingAccountId: "a1", businessType: "kiosco" },
    { eventType: "ConvertedToPaid", eventAt: new Date("2026-02-05T12:10:00Z"), campaignId: "c1", campaignCode: "CAMPA", campaignTier: "C1", billingAccountId: "a1", businessType: "kiosco" },
    { eventType: "TrialStarted", eventAt: new Date("2026-02-02T14:00:00Z"), campaignId: "c2", campaignCode: "CAMPB", campaignTier: "C2", billingAccountId: "a2", businessType: "distribuidora" },
    { eventType: "PaymentMethodAdded", eventAt: new Date("2026-02-20T10:00:00Z"), campaignId: "c2", campaignCode: "CAMPB", campaignTier: "C2", billingAccountId: "a2", businessType: "distribuidora" },
    { eventType: "ConvertedToPaid", eventAt: new Date("2026-02-22T10:00:00Z"), campaignId: "c2", campaignCode: "CAMPB", campaignTier: "C2", billingAccountId: "a2", businessType: "distribuidora" },
    { eventType: "TrialExpired", eventAt: new Date("2026-02-10T10:00:00Z"), campaignId: "c2", campaignCode: "CAMPB", campaignTier: "C2", billingAccountId: "a2", businessType: "distribuidora" },
    { eventType: "BecamePastDue", eventAt: new Date("2026-02-25T10:00:00Z"), campaignId: "c2", campaignCode: "CAMPB", campaignTier: "C2", billingAccountId: "a2", businessType: "distribuidora" },
  ];

  const result = aggregateTrialFunnelAnalytics({ leads, events });

  assert.equal(result.totals.signups, 3);
  assert.equal(result.totals.trialStarted, 2);
  assert.equal(result.totals.convertedToPaid, 2);
  assert.equal(result.totals.conversionRate, 100);

  const c1 = result.funnel.find((row) => row.campaignCode === "CAMPA");
  const c2 = result.funnel.find((row) => row.campaignCode === "CAMPB");
  assert.ok(c1);
  assert.ok(c2);
  assert.equal(c1?.signups, 2);
  assert.equal(c1?.trialStarted, 1);
  assert.equal(c1?.convertedToPaid, 1);
  assert.equal(c2?.trialExpired, 1);
  assert.equal(c2?.becamePastDue, 1);

  const cohort1 = result.cohorts.find((row) => row.cohortDate === "2026-02-01");
  const cohort2 = result.cohorts.find((row) => row.cohortDate === "2026-02-02");
  assert.ok(cohort1);
  assert.ok(cohort2);
  assert.equal(cohort1?.starts, 1);
  assert.equal(cohort1?.converted7d, 1);
  assert.equal(cohort1?.converted14d, 1);
  assert.equal(cohort1?.converted30d, 1);
  assert.equal(cohort2?.starts, 1);
  assert.equal(cohort2?.converted7d, 0);
  assert.equal(cohort2?.converted14d, 0);
  assert.equal(cohort2?.converted30d, 1);

  const kiosco = result.icp.find((row) => row.businessType === "kiosco");
  const distrib = result.icp.find((row) => row.businessType === "distribuidora");
  assert.equal(kiosco?.signups, 2);
  assert.equal(kiosco?.trialStarted, 1);
  assert.equal(kiosco?.convertedToPaid, 1);
  assert.equal(distrib?.signups, 1);
  assert.equal(distrib?.trialStarted, 1);
  assert.equal(distrib?.convertedToPaid, 1);
});

