import assert from "node:assert/strict";
import test from "node:test";
import { runCustomerHealthAutomations, scoreCustomerHealth } from "./customer-health";

test("customer health score is deterministic for healthy and at-risk fixtures", () => {
  const healthy = scoreCustomerHealth({
    installationId: "i1",
    instanceId: "inst-healthy",
    clientName: "Healthy Co",
    planName: "C2",
    billingStatus: "ACTIVE",
    monthlyOrders: 120,
    posActions30d: 45,
    campaignActions30d: 8,
    logins30d: 25,
    activeIncidents: 0,
    incidents30d: 0,
    jobFailures7d: 0,
    alerts7d: 0,
    healthStatus: "healthy",
    sloP95Ms: 220,
    sloErrorRate: 0.003,
    openInvoicePastDueDays: 0,
    softLimited: false,
    hardLimited: false,
    npsAvg: 9.2,
    csatAvg: 4.7,
    openFeedbackIssues: 0,
    integrationConnectorsTotal: 3,
    integrationConnectorsActive: 3,
    integrationFailures24h: 0,
    integrationDlqOpen: 0,
    csmUserId: "csm@vendor.test",
  });

  const atRisk = scoreCustomerHealth({
    installationId: "i2",
    instanceId: "inst-risk",
    clientName: "Risk Co",
    planName: "C1",
    billingStatus: "PAST_DUE",
    monthlyOrders: 0,
    posActions30d: 0,
    campaignActions30d: 0,
    logins30d: 1,
    activeIncidents: 1,
    incidents30d: 3,
    jobFailures7d: 5,
    alerts7d: 4,
    healthStatus: "degraded",
    sloP95Ms: 1800,
    sloErrorRate: 0.08,
    openInvoicePastDueDays: 18,
    softLimited: true,
    hardLimited: false,
    npsAvg: 3,
    csatAvg: 2,
    openFeedbackIssues: 2,
    integrationConnectorsTotal: 2,
    integrationConnectorsActive: 0,
    integrationFailures24h: 7,
    integrationDlqOpen: 14,
    csmUserId: "csm-risk@vendor.test",
  });

  assert.equal(healthy.state, "HEALTHY");
  assert.equal(healthy.score >= 75, true);
  assert.equal(healthy.playbooksSuggested.length, 0);

  assert.equal(atRisk.state, "AT_RISK");
  assert.equal(atRisk.score < 50, true);
  assert.equal(atRisk.reasons.length > 0, true);
  assert.equal(atRisk.playbooksSuggested.some((p) => p.includes("Billing")), true);
});

test("at-risk automations create deduped task + alert + csm mock email", async () => {
  const createdTasks: any[] = [];
  const createdAlerts: any[] = [];
  const createdEvidence: any[] = [];

  const prisma = {
    installation: {
      async findMany() {
        return [
          {
            id: "install-1",
            instanceId: "inst-risk",
            clientName: "Risk Co",
            domain: "risk.test",
            healthStatus: "degraded",
            sloP95Ms: 1600,
            sloErrorRate: 0.09,
            createdAt: new Date("2026-02-01T00:00:00Z"),
          },
        ];
      },
    },
    billingAccount: {
      async findMany() {
        return [
          {
            id: "ba-1",
            instanceId: "inst-risk",
            status: "PAST_DUE",
            monthlyOrders: 0,
            warningCount: 2,
            softLimitedAt: new Date("2026-02-20T00:00:00Z"),
            hardLimitedAt: null,
            plan: { name: "C1" },
          },
        ];
      },
    },
    billingInvoice: {
      async findMany() {
        return [
          {
            dueAt: new Date("2026-02-01T00:00:00Z"),
            account: { id: "ba-1", instanceId: "inst-risk" },
            status: "OPEN",
          },
        ];
      },
    },
    featureUsageSample: { async findMany() { return []; } },
    jobFailure: { async findMany() { return [{ installationId: "install-1" }, { installationId: "install-1" }]; } },
    alert: {
      async findMany() { return [{ installationId: "install-1", level: "warning" }]; },
      async findFirst() { return null; },
      async create({ data }: any) { createdAlerts.push(data); return { id: `a-${createdAlerts.length}`, ...data }; },
    },
    statusPageIncident: { async findMany() { return [{ installationId: "install-1", isClosed: false }]; } },
    integrationBuilderReport: {
      async findMany() {
        return [{ instanceId: "inst-risk", connectorsTotal: 2, connectorsActive: 0, deliveriesFailed24h: 5, dlqOpen: 8, capturedAt: new Date() }];
      },
    },
    feedbackSurveyResponse: { async findMany() { return []; } },
    feedbackIssue: { async findMany() { return [{ installationId: "install-1" }]; } },
    crmDeal: {
      async findMany() { return [{ installationId: "install-1", ownerUserId: "csm@vendor.test", updatedAt: new Date() }]; },
      async findFirst() { return { id: "deal-1", ownerUserId: "csm@vendor.test", title: "Risk deal", stage: "WON" }; },
    },
    crmDealTask: {
      async findFirst() { return null; },
      async create({ data }: any) { createdTasks.push(data); return { id: `t-${createdTasks.length}`, ...data }; },
    },
    complianceEvidence: {
      async findFirst() { return null; },
      async create({ data }: any) { createdEvidence.push(data); return { id: `e-${createdEvidence.length}`, ...data }; },
    },
  };

  const now = new Date("2026-02-26T12:00:00Z");
  const first = await runCustomerHealthAutomations(prisma as any, { actor: "cp:admin", now });
  assert.equal(first.atRisk, 1);
  assert.equal(first.tasksCreated, 1);
  assert.equal(first.alertsCreated, 1);
  assert.equal(first.emailsQueued, 1);

  // Simulate dedupe on second run using previously created rows.
  prisma.crmDealTask.findFirst = async () => ({ id: "existing-task" });
  prisma.alert.findFirst = async () => ({ id: "existing-alert" });
  prisma.complianceEvidence.findFirst = async () => ({ id: "existing-evidence" });
  const second = await runCustomerHealthAutomations(prisma as any, { actor: "cp:admin", now });
  assert.equal(second.tasksCreated, 0);
  assert.equal(second.alertsCreated, 0);
  assert.equal(second.emailsQueued, 0);
});

