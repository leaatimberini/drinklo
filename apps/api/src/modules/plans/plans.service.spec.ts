import { PlansService } from "./plans.service";

describe("PlansService", () => {
  const prismaMock: unknown = {
    planEntitlement: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    usageCounter: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    order: { count: jest.fn() },
    branch: { count: jest.fn() },
    companyPlugin: { count: jest.fn() },
    user: { count: jest.fn() },
  };

  beforeEach(() => {
    Object.values(prismaMock).forEach((delegate: unknown) => {
      if (delegate && typeof delegate === "object") {
        Object.values(delegate).forEach((fn: unknown) => {
          if (typeof fn?.mockReset === "function") fn.mockReset();
        });
      }
    });
  });

  it("returns catalog sorted by tier", async () => {
    prismaMock.planEntitlement.upsert.mockResolvedValue(null);
    prismaMock.planEntitlement.findMany.mockResolvedValue([{ tier: "C1" }, { tier: "C2" }, { tier: "C3" }]);
    const service = new PlansService(prismaMock);

    const result = await service.getPlanCatalog();

    expect(result).toHaveLength(3);
    expect(prismaMock.planEntitlement.upsert).toHaveBeenCalledTimes(3);
  });

  it("sets next tier for support workflow", async () => {
    prismaMock.planEntitlement.upsert.mockResolvedValue(null);
    prismaMock.planEntitlement.findMany.mockResolvedValue([{ tier: "C1" }, { tier: "C2" }, { tier: "C3" }]);
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: "s1",
      companyId: "c1",
      status: "ACTIVE_PAID",
      currentTier: "C1",
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
    });
    prismaMock.subscription.update.mockResolvedValue({
      companyId: "c1",
      nextTier: "C2",
      currentTier: "C1",
      status: "ACTIVE_PAID",
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
    });
    const service = new PlansService(prismaMock);

    const result = await service.setNextTier("c1", "C2");

    expect(result.nextTier).toBe("C2");
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { companyId: "c1" },
      data: { nextTier: "C2" },
    });
  });
});

