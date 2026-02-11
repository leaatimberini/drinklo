import { mapOrdersToWarehouse } from "./warehouse.service";
import { Prisma } from "@erp/db";

describe("warehouse ETL mapping", () => {
  it("maps order totals correctly", () => {
    const orders = [
      {
        id: "o1",
        companyId: "c1",
        customerEmail: "a@demo.local",
        status: "PAID",
        createdAt: new Date("2026-02-01T12:00:00Z"),
        shippingCost: new Prisma.Decimal(100),
        items: [
          { quantity: 2, unitPrice: new Prisma.Decimal(500) },
          { quantity: 1, unitPrice: new Prisma.Decimal(250) },
        ],
      },
    ];
    const rows = mapOrdersToWarehouse(orders as any);
    expect(rows).toHaveLength(1);
    expect(rows[0].item_total).toBe(1250);
    expect(rows[0].shipping_cost).toBe(100);
    expect(rows[0].order_total).toBe(1350);
  });
});
