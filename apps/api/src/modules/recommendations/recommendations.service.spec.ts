import { Prisma } from "@erp/db";
import { RecommendationsService } from "./recommendations.service";

describe("RecommendationsService", () => {
  const prismaMock: unknown = {
    company: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
    companySettings: { findFirst: jest.fn().mockResolvedValue({ ageGateMode: "18" }) },
    priceList: { findFirst: jest.fn().mockResolvedValue({ id: "pl1" }) },
    priceRule: {
      findMany: jest.fn().mockResolvedValue([
        { variantId: "v1", productId: null, minQty: 1, price: new Prisma.Decimal(1000) },
        { variantId: "v2", productId: null, minQty: 1, price: new Prisma.Decimal(1500) },
      ]),
    },
    stockItem: {
      groupBy: jest.fn().mockResolvedValue([
        { variantId: "v1", _sum: { quantity: 5 } },
        { variantId: "v2", _sum: { quantity: 3 } },
      ]),
    },
    eventLog: {
      findMany: jest.fn().mockResolvedValue([
        { payload: { productId: "p1" } },
        { payload: { productId: "p2" } },
      ]),
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([
        { orderId: "o1", productId: "p1", order: { createdAt: new Date("2026-01-01") } },
        { orderId: "o1", productId: "p2", order: { createdAt: new Date("2026-01-02") } },
        { orderId: "o2", productId: "p1", order: { createdAt: new Date("2026-01-03") } },
      ]),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([
        { createdAt: new Date("2026-01-01"), subtotal: new Prisma.Decimal(1000), discountTotal: new Prisma.Decimal(0), shippingCost: new Prisma.Decimal(0) },
        { createdAt: new Date("2026-01-10"), subtotal: new Prisma.Decimal(800), discountTotal: new Prisma.Decimal(0), shippingCost: new Prisma.Decimal(0) },
      ]),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: "p1", name: "Agua", isAlcoholic: false, variants: [{ id: "v1", sku: "A1", cost: new Prisma.Decimal(400) }] },
        { id: "p2", name: "Vino", isAlcoholic: true, variants: [{ id: "v2", sku: "V1", cost: new Prisma.Decimal(700) }] },
      ]),
    },
  };

  it("respects opt-out", async () => {
    const service = new RecommendationsService(prismaMock);
    const res = await service.getRecommendations({
      companyId: "c1",
      blocks: ["reorder"],
      limit: 6,
      cartProductIds: [],
      ageVerified: false,
      optOut: true,
    });
    expect(res.blocks).toEqual({});
  });

  it("filters alcoholic when age not verified", async () => {
    const service = new RecommendationsService(prismaMock);
    const res = await service.getRecommendations({
      companyId: "c1",
      blocks: ["reorder"],
      limit: 6,
      cartProductIds: [],
      ageVerified: false,
      optOut: false,
    });
    const items = res.blocks.reorder?.items ?? [];
    expect(items.find((item) => item.productId === "p2")).toBeUndefined();
  });
});
