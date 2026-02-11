import { ForecastingService } from "./forecasting.service";

describe("ForecastingService", () => {
  const prismaMock: any = {
    company: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
    saleItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          productId: "p1",
          quantity: 5,
          sale: { createdAt: new Date("2026-02-01"), discount: { gt: () => false } },
          product: { name: "Agua" },
        },
        {
          productId: "p1",
          quantity: 7,
          sale: { createdAt: new Date("2026-02-02"), discount: { gt: () => true } },
          product: { name: "Agua" },
        },
      ]),
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          productId: "p1",
          quantity: 3,
          order: { createdAt: new Date("2026-02-03"), discountTotal: { gt: () => false }, couponCode: null },
          product: { name: "Agua" },
        },
      ]),
    },
    stockItem: {
      findMany: jest.fn().mockResolvedValue([
        { quantity: 4, variant: { productId: "p1" } },
        { quantity: 2, variant: { productId: "p1" } },
      ]),
    },
  };

  it("returns deterministic forecast", async () => {
    const service = new ForecastingService(prismaMock);
    const result = await service.forecast("c1", 7);
    expect(result).toHaveLength(1);
    const forecast = result[0];
    expect(forecast.productId).toBe("p1");
    expect(forecast.forecast).toHaveLength(7);
    expect(forecast.reorderPoint).toBeGreaterThanOrEqual(0);
    expect(forecast.reorderQuantity).toBeGreaterThanOrEqual(0);
  });
});
