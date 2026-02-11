import { PromosService } from "./promos.service";
import { CouponType } from "@erp/db";

describe("PromosService", () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      coupon: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      couponRedemption: {
        count: jest.fn(),
        create: jest.fn(),
      },
      loyaltyRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      loyaltyAccount: {
        findUnique: jest.fn(),
      },
      ...overrides,
    };
    return { service: new PromosService(prisma as any), prisma };
  }

  it("applies percent coupon only to eligible category", async () => {
    const { service, prisma } = buildService();
    prisma.coupon.findFirst.mockResolvedValue({
      id: "c1",
      companyId: "co1",
      code: "CAT10",
      type: CouponType.PERCENT,
      amount: 10,
      currency: "ARS",
      active: true,
      usageCount: 0,
      categoryId: "cat-1",
    });
    prisma.couponRedemption.count.mockResolvedValue(0);

    const result = await service.validateCoupon("co1", {
      code: "CAT10",
      items: [
        { productId: "p1", quantity: 1, unitPrice: 100, categoryIds: ["cat-1"] },
        { productId: "p2", quantity: 1, unitPrice: 200, categoryIds: ["cat-2"] },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount).toBe(10);
    }
  });

  it("applies free shipping coupon", async () => {
    const { service, prisma } = buildService();
    prisma.coupon.findFirst.mockResolvedValue({
      id: "c2",
      companyId: "co1",
      code: "SHIP",
      type: CouponType.FREE_SHIPPING,
      amount: 0,
      currency: "ARS",
      active: true,
      usageCount: 0,
    });
    prisma.couponRedemption.count.mockResolvedValue(0);

    const result = await service.validateCoupon("co1", {
      code: "SHIP",
      subtotal: 1000,
      shippingCost: 350,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount).toBe(350);
      expect(result.freeShipping).toBe(true);
    }
  });

  it("blocks when usage limit reached", async () => {
    const { service, prisma } = buildService();
    prisma.coupon.findFirst.mockResolvedValue({
      id: "c3",
      companyId: "co1",
      code: "LIMIT",
      type: CouponType.FIXED,
      amount: 100,
      currency: "ARS",
      active: true,
      usageCount: 5,
      usageLimit: 5,
    });

    const result = await service.validateCoupon("co1", { code: "LIMIT", subtotal: 500 });
    expect(result.ok).toBe(false);
  });
});
