import { BadRequestException } from "@nestjs/common";
import { StockReservationService } from "./stock-reservation.service";

class FakeClient {
  stock = { quantity: 1, reservedQuantity: 0 };
  stockItem = {
    findFirst: jest.fn(async () => ({ id: "s1" })),
  };
  stockReservation = {
    create: jest.fn(async () => ({})),
  };
  stockMovement = {
    create: jest.fn(async () => ({})),
  };
  async $executeRaw(strings: TemplateStringsArray, ...values: any[]) {
    const qty = values[0];
    if (this.stock.quantity - this.stock.reservedQuantity >= qty) {
      this.stock.reservedQuantity += qty;
      return 1;
    }
    return 0;
  }
}

describe("StockReservationService", () => {
  it("allows only one reservation for last item", async () => {
    const svc = new StockReservationService({} as any);
    const client = new FakeClient() as any;

    const reserve = () =>
      svc.reserveWithClient(client, "c1", "o1", [{ variantId: "v1", quantity: 1 }], new Date());

    const results = await Promise.allSettled([reserve(), reserve()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;

    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
  });
});
