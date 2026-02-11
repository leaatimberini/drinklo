import { AutomationService } from "./automation.service";
import { ActionType, FlowStatus } from "@erp/db";

function buildService(overrides: any = {}) {
  const prisma = {
    flow: {
      findUnique: jest.fn(),
    },
    consentRecord: {
      findFirst: jest.fn(),
    },
    suppressionList: {
      findFirst: jest.fn(),
    },
    automationSendLog: {
      count: jest.fn(),
      create: jest.fn(),
    },
    flowMetric: {
      upsert: jest.fn(),
    },
    ...overrides,
  };
  const emails = {
    sendTest: jest.fn(),
  };
  const service = new AutomationService(prisma as any, emails as any);
  return { service, prisma, emails };
}

describe("AutomationService guardrails", () => {
  it("blocks when consent is required and missing", async () => {
    const { service, prisma } = buildService();
    prisma.flow.findUnique.mockResolvedValue({
      id: "f1",
      companyId: "c1",
      status: FlowStatus.ACTIVE,
      settings: { guardrails: { consentRequired: true } },
      actions: [{ id: "a1", type: ActionType.EMAIL, config: { templateId: "t1" }, delayMinutes: 0, position: 0 }],
      trigger: {},
      company: { settings: { marketingConsentRequired: true } },
    });
    prisma.consentRecord.findFirst.mockResolvedValue(null);

    const result = await service.runFlowTest("c1", "f1", { recipient: "test@demo.local", customerId: "u1" });
    expect(result).toEqual({ ok: false, reason: "consent_required" });
  });

  it("blocks during quiet hours", async () => {
    const { service, prisma } = buildService();
    prisma.flow.findUnique.mockResolvedValue({
      id: "f1",
      companyId: "c1",
      status: FlowStatus.ACTIVE,
      settings: { guardrails: { quietHours: { start: "00:00", end: "23:59" }, consentRequired: false } },
      actions: [],
      trigger: {},
      company: { settings: { marketingConsentRequired: false } },
    });

    const result = await service.runFlowTest("c1", "f1", { recipient: "test@demo.local" });
    expect(result).toEqual({ ok: false, reason: "quiet_hours" });
  });

  it("applies frequency cap per recipient", async () => {
    const { service, prisma } = buildService();
    prisma.flow.findUnique.mockResolvedValue({
      id: "f1",
      companyId: "c1",
      status: FlowStatus.ACTIVE,
      settings: { guardrails: { frequencyCapPerDay: 1, consentRequired: false, quietHours: { start: "23:00", end: "23:00" } } },
      actions: [{ id: "a1", type: ActionType.EMAIL, config: { templateId: "t1" }, delayMinutes: 0, position: 0 }],
      trigger: {},
      company: { settings: { marketingConsentRequired: false } },
    });
    prisma.automationSendLog.count.mockResolvedValue(1);
    prisma.suppressionList.findFirst.mockResolvedValue(null);

    const result = await service.runFlowTest("c1", "f1", { recipient: "test@demo.local" });
    expect(result.ok).toBe(true);
    expect(result.results[0].status).toBe("frequency_capped");
  });

  it("suppresses recipient", async () => {
    const { service, prisma } = buildService();
    prisma.flow.findUnique.mockResolvedValue({
      id: "f1",
      companyId: "c1",
      status: FlowStatus.ACTIVE,
      settings: { guardrails: { consentRequired: false, quietHours: { start: "23:00", end: "23:00" } } },
      actions: [{ id: "a1", type: ActionType.EMAIL, config: { templateId: "t1" }, delayMinutes: 0, position: 0 }],
      trigger: {},
      company: { settings: { marketingConsentRequired: false } },
    });
    prisma.suppressionList.findFirst.mockResolvedValue({ id: "s1" });
    prisma.automationSendLog.count.mockResolvedValue(0);

    const result = await service.runFlowTest("c1", "f1", { recipient: "test@demo.local" });
    expect(result.ok).toBe(true);
    expect(result.results[0].status).toBe("suppressed");
  });
});
