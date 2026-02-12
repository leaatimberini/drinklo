import { SandboxService } from "./sandbox.service";

describe("SandboxService", () => {
  it("deterministic mocks return stable responses", () => {
    const prisma: any = {};
    const reservations: any = {};
    const service = new SandboxService(prisma, reservations);

    expect(service.deterministicPreference("order-1")).toEqual(service.deterministicPreference("order-1"));
    expect(service.deterministicShipmentOptions("C1000")).toEqual(service.deterministicShipmentOptions("C1000"));
    expect(
      service.deterministicArcaInvoice({
        orderRef: "order-1",
        pointOfSale: 1,
        type: "B",
        total: 1000,
        currency: "ARS",
      }),
    ).toEqual(
      service.deterministicArcaInvoice({
        orderRef: "order-1",
        pointOfSale: 1,
        type: "B",
        total: 1000,
        currency: "ARS",
      }),
    );
  });

  it("resetCompany scopes deletions by companyId", async () => {
    const tx = {
      stockReservationLot: { deleteMany: jest.fn() },
      stockReservation: { deleteMany: jest.fn() },
      orderStatusEvent: { deleteMany: jest.fn() },
      payment: { deleteMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      orderItem: { deleteMany: jest.fn() },
      order: { deleteMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      invoice: { deleteMany: jest.fn(), create: jest.fn() },
      stockMovement: { deleteMany: jest.fn(), create: jest.fn() },
      stockItem: { deleteMany: jest.fn(), create: jest.fn() },
      stockLocation: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "loc1" }) },
      shippingZone: { deleteMany: jest.fn(), create: jest.fn() },
      priceRule: { deleteMany: jest.fn(), create: jest.fn() },
      priceList: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "pl1" }) },
      productAttribute: { deleteMany: jest.fn() },
      productCategory: { deleteMany: jest.fn(), create: jest.fn() },
      productVariant: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "v1" }) },
      product: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "p1" }) },
      category: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "c1" }) },
      address: { deleteMany: jest.fn() },
      customer: { deleteMany: jest.fn() },
      companySettings: { update: jest.fn() },
    } as any;

    const prisma: any = {
      $transaction: jest.fn(async (cb: any) => cb(tx)),
      companySettings: {
        findUnique: jest.fn().mockResolvedValue({ sandboxMode: true, sandboxResetAt: new Date() }),
      },
    };
    const reservations: any = { confirm: jest.fn() };

    const service = new SandboxService(prisma, reservations);
    await service.resetCompany("company-a");

    expect(tx.product.deleteMany).toHaveBeenCalledWith({ where: { companyId: "company-a" } });
    expect(tx.customer.deleteMany).toHaveBeenCalledWith({ where: { companyId: "company-a" } });
    expect(tx.companySettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-a" } }),
    );
  });
});
