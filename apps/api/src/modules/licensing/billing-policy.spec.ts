import { proration, resolveTier, trialState } from "./billing-policy";

describe("billing advanced policy", () => {
  it("handles trial expiry with grace", () => {
    const now = new Date("2026-02-20T00:00:00.000Z");
    expect(trialState(now, new Date("2026-02-19T00:00:00.000Z"))).toBe("grace");
    expect(trialState(now, new Date("2026-02-10T00:00:00.000Z"))).toBe("expired");
  });

  it("upgrades tier by orders/gmv", () => {
    const tier = resolveTier({
      basePlan: "bebidas",
      monthlyOrders: 1400,
      monthlyGmvArs: 12_000_000,
      tiers: [
        { maxOrders: 500, maxGmvArs: 2_000_000, priceMultiplier: 1 },
        { maxOrders: 1500, maxGmvArs: 15_000_000, priceMultiplier: 1.35 },
        { priceMultiplier: 1.8 },
      ],
    });
    expect(tier.priceMultiplier).toBe(1.35);
  });

  it("calculates proration for mid-cycle upgrade", () => {
    const delta = proration({
      oldAmount: 50000,
      newAmount: 90000,
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-03T00:00:00.000Z"),
      changeAt: new Date("2026-02-16T00:00:00.000Z"),
    });
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBe(20000);
  });
});
