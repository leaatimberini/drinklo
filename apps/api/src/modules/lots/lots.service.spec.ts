import { BadRequestException } from "@nestjs/common";
import { LotsService } from "./lots.service";

class FakeLotsClient {
  settings = { pickingStrategy: "FEFO", blockExpiredLotSale: false };
  lots: Array<unknown> = [];

  companySettings = {
    findFirst: jest.fn(async () => this.settings),
  };

  batchLot = {
    findMany: jest.fn(async () => {
      return [...this.lots].sort((a, b) => {
        const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (ae !== be) return ae - be;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }),
  };

  async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    const sql = strings.join("?");
    if (sql.includes('SET "quantity" = "quantity" -')) {
      const [qty, lotId] = values;
      const lot = this.lots.find((item) => item.id === lotId);
      if (!lot || lot.quantity < qty) return 0;
      lot.quantity -= qty;
      return 1;
    }
    if (sql.includes('SET "reservedQuantity" = "reservedQuantity" +')) {
      const [qty, lotId] = values;
      const lot = this.lots.find((item) => item.id === lotId);
      if (!lot || lot.quantity - lot.reservedQuantity < qty) return 0;
      lot.reservedQuantity += qty;
      return 1;
    }
    return 1;
  }

  stockReservationLot = {
    create: jest.fn(async () => ({})),
    findMany: jest.fn(async () => []),
  };
}

describe("LotsService", () => {
  it("allocates FEFO by earliest expiry", async () => {
    const service = new LotsService({} as unknown);
    const client = new FakeLotsClient();
    client.lots = [
      {
        id: "l1",
        stockItemId: "s1",
        lotCode: "LATE",
        quantity: 5,
        reservedQuantity: 0,
        expiryDate: new Date("2026-04-20T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "l2",
        stockItemId: "s1",
        lotCode: "EARLY",
        quantity: 5,
        reservedQuantity: 0,
        expiryDate: new Date("2026-03-20T00:00:00Z"),
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];

    const picks = await service.allocateLotsWithClient(client as unknown, "c1", "v1", 2);
    expect(picks[0].lotCode).toBe("EARLY");
    expect(picks[0].quantity).toBe(2);
  });

  it("consumes sale using multiple lots", async () => {
    const service = new LotsService({} as unknown);
    const client = new FakeLotsClient();
    client.lots = [
      {
        id: "l1",
        stockItemId: "s1",
        lotCode: "A",
        quantity: 1,
        reservedQuantity: 0,
        expiryDate: new Date("2026-03-20T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "l2",
        stockItemId: "s1",
        lotCode: "B",
        quantity: 2,
        reservedQuantity: 0,
        expiryDate: new Date("2026-03-25T00:00:00Z"),
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];

    const picks = await service.consumeLotsForSaleWithClient(client as unknown, "c1", "v1", 3);
    expect(picks).toHaveLength(2);
    expect(client.lots[0].quantity).toBe(0);
    expect(client.lots[1].quantity).toBe(0);
  });

  it("blocks expired lots when setting is enabled", async () => {
    const service = new LotsService({} as unknown);
    const client = new FakeLotsClient();
    client.settings = { pickingStrategy: "FEFO", blockExpiredLotSale: true };
    client.lots = [
      {
        id: "l1",
        stockItemId: "s1",
        lotCode: "EXP",
        quantity: 2,
        reservedQuantity: 0,
        expiryDate: new Date("2020-01-01T00:00:00Z"),
        createdAt: new Date("2019-01-01T00:00:00Z"),
      },
    ];

    await expect(service.allocateLotsWithClient(client as unknown, "c1", "v1", 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
