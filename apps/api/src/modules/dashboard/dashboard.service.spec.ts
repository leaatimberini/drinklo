import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  it("returns zeroes when no company", async () => {
    const prismaMock = {
      company: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn(),
    };
    const service = new DashboardService(prismaMock as never as never);
    const result = await service.summary({});
    expect(result.kpis.sales).toBe(0);
    expect(result.topProducts).toEqual([]);
  });

  it("aggregates results", async () => {
    const prismaMock = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ sales: 1000, tickets: 2 }])
        .mockResolvedValueOnce([{ productId: "p1", name: "Prod", revenue: 800, qty: 3 }])
        .mockResolvedValueOnce([{ variantId: "v1", sku: "SKU", quantity: 2 }]),
    };

    const service = new DashboardService(prismaMock as never as never);
    const result = await service.summary({ top: 5, lowStock: 3 });
    expect(result.kpis.sales).toBe(1000);
    expect(result.kpis.tickets).toBe(2);
    expect(result.topProducts.length).toBe(1);
    expect(result.lowStock.length).toBe(1);
  });

  it("uses limited number of queries", async () => {
    const prismaMock = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
      $queryRaw: jest.fn().mockResolvedValueOnce([{ sales: 0, tickets: 0 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    };

    const service = new DashboardService(prismaMock as never as never);
    await service.summary({});
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
  });
});
