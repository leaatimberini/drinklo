import { StockReservationService } from "./stock-reservation.service";

class FakeClient {
  stock = { quantity: 1, reservedQuantity: 0 };
  stockReservation = {
    create: jest.fn(async ({ data }: any) => ({ id: `r-${data.orderId}` })),
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
    const lots = {
      allocateLotsWithClient: jest.fn(async () => [{ lotId: "l1", stockItemId: "s1", quantity: 1, lotCode: "L1", expiryDate: null }]),
      reserveLotsWithClient: jest.fn(async () => undefined),
      confirmReservationLotsWithClient: jest.fn(async () => undefined),
      releaseReservationLotsWithClient: jest.fn(async () => undefined),
    };
    const svc = new StockReservationService({} as any, lots as any);
    const client = new FakeClient() as any;

    const reserve = (orderId: string) =>
      svc.reserveWithClient(client, "c1", orderId, [{ variantId: "v1", quantity: 1 }], new Date());

    const results = await Promise.allSettled([reserve("o1"), reserve("o2")]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;

    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
  });
});
