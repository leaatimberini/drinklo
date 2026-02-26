import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

describe("SubscriptionLifecycleService", () => {
  const prismaMock: unknown = {
    subscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    subscriptionLifecycleNotification: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findMany: jest.fn() },
  };
  const auditMock = { append: jest.fn() };
  const botAuditMock = { record: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-27T13:45:00.000Z"));
    for (const delegate of Object.values(prismaMock) as unknown[]) {
      for (const fn of Object.values(delegate) as unknown[]) {
        if (typeof fn?.mockReset === "function") fn.mockReset();
      }
    }
    auditMock.append.mockReset();
    botAuditMock.record.mockReset();
    delete process.env.SUBSCRIPTION_ALERT_TELEGRAM_CHAT_IDS;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("transitions TRIAL_ACTIVE to GRACE with fake clock and is idempotent", async () => {
    const service = new SubscriptionLifecycleService(prismaMock, auditMock as unknown, botAuditMock as unknown);
    jest.spyOn(service as unknown, "notifyTransition").mockResolvedValue(1);

    const candidate = {
      id: "sub1",
      companyId: "c1",
      status: "TRIAL_ACTIVE",
      currentTier: "C1",
      nextTier: null,
      currentPeriodStart: new Date("2026-02-25T13:45:00.000Z"),
      currentPeriodEnd: new Date("2026-03-27T13:45:00.000Z"),
      trialEndAt: new Date("2026-03-27T13:45:00.000Z"),
      graceEndAt: null,
      lastPaymentAt: null,
      cancelledAt: null,
      createdAt: new Date("2026-02-25T13:45:00.000Z"),
      updatedAt: new Date("2026-02-25T13:45:00.000Z"),
    };

    prismaMock.subscription.findMany.mockResolvedValue([candidate]);
    prismaMock.subscription.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await service.runTrialExpirer();
    const second = await service.runTrialExpirer();

    expect(first.transitioned).toBe(1);
    expect(second.transitioned).toBe(0);
    expect(auditMock.append).toHaveBeenCalledTimes(1);
    expect(prismaMock.subscription.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: "sub1", status: "TRIAL_ACTIVE" }),
        data: expect.objectContaining({ status: "GRACE", graceEndAt: expect.any(Date) }),
      }),
    );
  });

  it("handles ACTIVE_PAID -> PAST_DUE -> GRACE transitions with fake clock", async () => {
    const service = new SubscriptionLifecycleService(prismaMock, auditMock as unknown, botAuditMock as unknown);
    jest.spyOn(service as unknown, "notifyTransition").mockResolvedValue(1);

    const activePaid = {
      id: "sub2",
      companyId: "c1",
      status: "ACTIVE_PAID",
      currentTier: "C1",
      nextTier: null,
      currentPeriodStart: new Date("2026-02-01T03:00:00.000Z"),
      currentPeriodEnd: new Date("2026-03-01T03:00:00.000Z"),
      trialEndAt: null,
      graceEndAt: null,
      lastPaymentAt: new Date("2026-02-15T03:00:00.000Z"),
      cancelledAt: null,
      createdAt: new Date("2026-02-01T03:00:00.000Z"),
      updatedAt: new Date("2026-02-15T03:00:00.000Z"),
    };
    const pastDue = { ...activePaid, status: "PAST_DUE", lastPaymentAt: null };

    prismaMock.subscription.findMany.mockImplementation(async ({ where }: unknown) => {
      if (where?.status === "ACTIVE_PAID") return [activePaid];
      if (where?.status === "PAST_DUE") return [pastDue];
      return [];
    });
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.runPastDueHandler();

    expect(result.pastDueTransitioned).toBe(1);
    expect(result.graceTransitioned).toBe(1);
    expect(auditMock.append).toHaveBeenCalledTimes(2);
  });
});

