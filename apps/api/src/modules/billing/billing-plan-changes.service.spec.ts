import { BillingPlanChangesService } from "./billing-plan-changes.service";

describe("BillingPlanChangesService", () => {
  const prismaMock: any = {
    $transaction: jest.fn(),
    subscription: {
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    prorationInvoice: {
      create: jest.fn(),
    },
  };
  const plansMock: any = {
    getPlanCatalog: jest.fn(),
    getSubscription: jest.fn(),
    getCurrentUsage: jest.fn(),
  };
  const auditMock = { append: jest.fn() };
  const recurringMock = { createOrUpdatePreapproval: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
    prismaMock.$transaction.mockReset();
    prismaMock.subscription.update.mockReset();
    prismaMock.subscription.findMany.mockReset();
    prismaMock.subscription.updateMany.mockReset();
    prismaMock.prorationInvoice.create.mockReset();
    plansMock.getPlanCatalog.mockReset();
    plansMock.getSubscription.mockReset();
    plansMock.getCurrentUsage.mockReset();
    auditMock.append.mockReset();
    recurringMock.createOrUpdatePreapproval.mockReset();
  });

  afterEach(() => jest.useRealTimers());

  function buildService() {
    return new BillingPlanChangesService(prismaMock, plansMock, auditMock as any, recurringMock as any);
  }

  function catalog() {
    return [
      { tier: "C1", monthlyPriceArs: 49900, ordersMonth: 2500, apiCallsMonth: 150000, storageGb: 10, pluginsMax: 5, branchesMax: 1, adminUsersMax: 5 },
      { tier: "C2", monthlyPriceArs: 149900, ordersMonth: 15000, apiCallsMonth: 1000000, storageGb: 100, pluginsMax: 25, branchesMax: 5, adminUsersMax: 25 },
      { tier: "C3", monthlyPriceArs: 399900, ordersMonth: 100000, apiCallsMonth: 10000000, storageGb: 1000, pluginsMax: 200, branchesMax: 50, adminUsersMax: 250 },
    ];
  }

  it("upgrade inmediato actualiza tier y genera proration invoice", async () => {
    const service = buildService();
    const sub = {
      id: "s1",
      companyId: "c1",
      status: "ACTIVE_PAID",
      currentTier: "C1",
      nextTier: null,
      currentPeriodStart: new Date("2026-03-01T03:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T03:00:00.000Z"),
      trialEndAt: null,
    };
    plansMock.getPlanCatalog.mockResolvedValue(catalog());
    plansMock.getSubscription.mockResolvedValue(sub);
    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        subscription: {
          update: jest.fn().mockResolvedValue({ ...sub, currentTier: "C2" }),
        },
        prorationInvoice: {
          create: jest.fn().mockResolvedValue({
            id: "pi1",
            subscriptionId: "s1",
            items: [{ id: "i1" }, { id: "i2" }],
          }),
        },
      }),
    );

    const result = (await service.upgrade("c1", "C2", "u1", false, new Date("2026-03-10T12:00:00.000Z"))) as any;

    expect(result.immediate).toBe(true);
    expect(result.subscription.currentTier).toBe("C2");
    expect(result.prorationInvoice.id).toBe("pi1");
    expect(auditMock.append).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "c1",
        action: "subscription.plan.upgrade",
      }),
    );
  });

  it("downgrade se aplica en proximo ciclo y activa soft limit si excede cuotas", async () => {
    const service = buildService();
    plansMock.getPlanCatalog.mockResolvedValue(catalog());
    plansMock.getCurrentUsage.mockResolvedValue({
      periodKey: "2026-04",
      ordersCount: 3000,
      apiCallsCount: 10,
      storageGbUsed: 2,
      pluginsCount: 1,
      branchesCount: 1,
      adminUsersCount: 1,
    });

    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: "s2",
        companyId: "c1",
        status: "ACTIVE_PAID",
        currentTier: "C2",
        nextTier: "C1",
        currentPeriodStart: new Date("2026-03-01T03:00:00.000Z"),
        currentPeriodEnd: new Date("2026-04-01T03:00:00.000Z"),
        cancelAtPeriodEnd: false,
      },
    ]);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.applyDueScheduledChanges(new Date("2026-04-01T04:00:00.000Z"), "test");

    expect(result.applied).toBe(1);
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentTier: "C1",
          nextTier: null,
          softLimited: true,
          softLimitReason: "DOWNGRADE_QUOTA_EXCEEDED_SOFT_LIMIT",
        }),
      }),
    );
    expect(auditMock.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "subscription.plan.downgrade_applied",
      }),
    );
  });
});
