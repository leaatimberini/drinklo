import { GovernanceEntity } from "@erp/db";
import { DataGovernanceService } from "./data-governance.service";

function basePrisma() {
  return {
    dataRetentionPolicy: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        { entity: GovernanceEntity.ORDERS, retentionDays: 365 },
        { entity: GovernanceEntity.LOGS, retentionDays: 90 },
        { entity: GovernanceEntity.EVENTS, retentionDays: 180 },
        { entity: GovernanceEntity.MARKETING, retentionDays: 365 },
      ]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    companySettings: {
      findUnique: jest.fn().mockResolvedValue({ retentionOrdersDays: 365, retentionLogsDays: 90, retentionMarketingDays: 365 }),
    },
    licenseKey: {
      findUnique: jest.fn().mockResolvedValue({ plan: "pro" }),
    },
    legalHold: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    governanceRun: {
      create: jest.fn().mockResolvedValue({ id: "run-1", startedAt: new Date("2026-02-01T00:00:00.000Z") }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: "run-1",
        startedAt: new Date("2026-02-01T00:00:00.000Z"),
        finishedAt: new Date("2026-02-01T00:10:00.000Z"),
        status: data.status,
      })),
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([{ id: "o1", customerEmail: "a@a.com", createdAt: new Date("2020-01-01T00:00:00.000Z"), shippingMeta: null }]),
      update: jest.fn().mockResolvedValue({ id: "o1" }),
    },
    eventLog: {
      findMany: jest.fn().mockResolvedValue([{ id: "e1", payload: { customerEmail: "a@a.com" }, receivedAt: new Date("2020-01-01T00:00:00.000Z") }]),
      delete: jest.fn().mockResolvedValue({ id: "e1" }),
    },
    automationSendLog: {
      findMany: jest.fn().mockResolvedValue([{ id: "m1", recipient: "a@a.com", sentAt: new Date("2020-01-01T00:00:00.000Z") }]),
      delete: jest.fn().mockResolvedValue({ id: "m1" }),
    },
    emailEventLog: {
      findMany: jest.fn().mockResolvedValue([{ id: "me1", recipient: "a@a.com", createdAt: new Date("2020-01-01T00:00:00.000Z"), payload: {} }]),
      delete: jest.fn().mockResolvedValue({ id: "me1" }),
    },
    webhookLog: {
      findMany: jest.fn().mockResolvedValue([{ id: "w1", payload: { customerEmail: "a@a.com" }, receivedAt: new Date("2020-01-01T00:00:00.000Z") }]),
      delete: jest.fn().mockResolvedValue({ id: "w1" }),
    },
    privacyRequest: {
      findMany: jest.fn().mockResolvedValue([{ id: "p1", customerId: "c1", createdAt: new Date("2020-01-01T00:00:00.000Z") }]),
      delete: jest.fn().mockResolvedValue({ id: "p1" }),
    },
    botCommandLog: {
      findMany: jest.fn().mockResolvedValue([{ id: "b1" }]),
      delete: jest.fn().mockResolvedValue({ id: "b1" }),
    },
    customer: {
      findFirst: jest.fn(),
    },
    company: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe("DataGovernanceService", () => {
  it("runs purge and updates summary", async () => {
    const prisma = basePrisma();
    const service = new DataGovernanceService(prisma);

    const result = await service.runPurge("co1", "u1", "manual");

    expect(result.status).toBe("DONE");
    expect(prisma.order.update).toHaveBeenCalledTimes(1);
    expect(prisma.eventLog.delete).toHaveBeenCalledTimes(1);
    expect(prisma.webhookLog.delete).toHaveBeenCalledTimes(1);
    expect(prisma.automationSendLog.delete).toHaveBeenCalledTimes(1);
    expect(prisma.emailEventLog.delete).toHaveBeenCalledTimes(1);
    expect(prisma.privacyRequest.delete).toHaveBeenCalledTimes(1);
  });

  it("does not purge held records", async () => {
    const prisma = basePrisma();
    prisma.legalHold.findMany.mockResolvedValue([
      {
        customerId: "c1",
        customerEmailSnapshot: "a@a.com",
        periodFrom: new Date("2019-01-01T00:00:00.000Z"),
        periodTo: new Date("2030-01-01T00:00:00.000Z"),
      },
    ]);

    const service = new DataGovernanceService(prisma);
    const result = await service.runPurge("co1", "u1", "manual");

    expect(result.summary.ORDERS.skippedByHold).toBeGreaterThan(0);
    expect(result.summary.EVENTS.skippedByHold).toBeGreaterThan(0);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.eventLog.delete).not.toHaveBeenCalled();
    expect(prisma.webhookLog.delete).not.toHaveBeenCalled();
    expect(prisma.automationSendLog.delete).not.toHaveBeenCalled();
    expect(prisma.emailEventLog.delete).not.toHaveBeenCalled();
    expect(prisma.privacyRequest.delete).not.toHaveBeenCalled();
  });
});
