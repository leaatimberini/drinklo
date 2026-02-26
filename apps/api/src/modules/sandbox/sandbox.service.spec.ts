import { SandboxService } from "./sandbox.service";
import { PrismaService } from "../prisma/prisma.service";
import { StockReservationService } from "../stock-reservations/stock-reservation.service";

type SandboxReservationsMock = { confirm: jest.Mock };
type SandboxPrismaCtor = {
  $transaction: jest.Mock;
  companySettings: { findUnique: jest.Mock };
};

type DemoTxMock = {
  [K in
    | "stockReservationLot"
    | "stockReservation"
    | "orderStatusEvent"
    | "payment"
    | "orderItem"
    | "order"
    | "invoice"
    | "stockMovement"
    | "stockItem"
    | "stockLocation"
    | "shippingZone"
    | "priceRule"
    | "priceList"
    | "automationSendLog"
    | "flowMetric"
    | "action"
    | "flow"
    | "campaign"
    | "trigger"
    | "segment"
    | "emailEventLog"
    | "productAttribute"
    | "productCategory"
    | "productVariant"
    | "product"
    | "category"
    | "address"
    | "customer"
    | "companySettings"]: Record<string, jest.Mock>;
};

describe("SandboxService", () => {
  it("deterministic mocks return stable responses", () => {
    const prisma = {} as PrismaService;
    const reservations = {} as StockReservationService;
    const service = new SandboxService(prisma as never, reservations);

    expect(service.deterministicPreference("order-1")).toEqual(service.deterministicPreference("order-1"));
    expect(service.deterministicShipmentOptions("C1000")).toEqual(service.deterministicShipmentOptions("C1000"));
    const invoiceA = service.deterministicArcaInvoice({
      orderRef: "order-1",
      pointOfSale: 1,
      type: "B",
      total: 1000,
      currency: "ARS",
    });
    const invoiceB = service.deterministicArcaInvoice({
      orderRef: "order-1",
      pointOfSale: 1,
      type: "B",
      total: 1000,
      currency: "ARS",
    });
    expect({ ...invoiceA, caeDue: invoiceA.caeDue.toISOString() }).toEqual({
      ...invoiceB,
      caeDue: invoiceB.caeDue.toISOString(),
    });
  });

  it("resetCompany scopes deletions by companyId", async () => {
    const tx: DemoTxMock = {
      stockReservationLot: { deleteMany: jest.fn() },
      stockReservation: { deleteMany: jest.fn() },
      orderStatusEvent: { deleteMany: jest.fn(), create: jest.fn() },
      payment: { deleteMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      orderItem: { deleteMany: jest.fn(), create: jest.fn() },
      order: {
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: "o1" })
          .mockResolvedValueOnce({ id: "o2" }),
      },
      invoice: { deleteMany: jest.fn(), create: jest.fn() },
      stockMovement: { deleteMany: jest.fn(), create: jest.fn() },
      stockItem: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "si1" }) },
      stockLocation: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "loc1" }) },
      shippingZone: { deleteMany: jest.fn(), create: jest.fn() },
      priceRule: { deleteMany: jest.fn(), create: jest.fn() },
      priceList: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "pl1" }) },
      automationSendLog: { deleteMany: jest.fn() },
      flowMetric: { deleteMany: jest.fn() },
      action: { deleteMany: jest.fn() },
      flow: { deleteMany: jest.fn() },
      campaign: { deleteMany: jest.fn(), createMany: jest.fn() },
      trigger: { deleteMany: jest.fn() },
      segment: { deleteMany: jest.fn() },
      emailEventLog: { deleteMany: jest.fn() },
      productAttribute: { deleteMany: jest.fn() },
      productCategory: { deleteMany: jest.fn(), create: jest.fn() },
      productVariant: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "v1" }) },
      product: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "p1" }) },
      category: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: "c1" }) },
      address: { deleteMany: jest.fn(), create: jest.fn() },
      customer: {
        deleteMany: jest.fn(),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: "cust1", name: "Cliente Demo Uno", email: "cliente1@demo.local", phone: "111" })
          .mockResolvedValueOnce({ id: "cust2", name: "Cliente Demo Dos", email: "cliente2@demo.local", phone: "222" }),
      },
      companySettings: { update: jest.fn() },
    };

    const prisma: SandboxPrismaCtor = {
      $transaction: jest.fn(async (cb: (trx: DemoTxMock) => Promise<unknown>) => cb(tx)),
      companySettings: {
        findUnique: jest.fn().mockResolvedValue({ sandboxMode: true, sandboxResetAt: new Date() }),
      },
    };
    const reservations: SandboxReservationsMock = { confirm: jest.fn() };

    const service = new SandboxService(prisma as never as PrismaService, reservations as StockReservationService);
    await service.resetCompany("company-a");

    expect(tx.product.deleteMany).toHaveBeenCalledWith({ where: { companyId: "company-a" } });
    expect(tx.customer.deleteMany).toHaveBeenCalledWith({ where: { companyId: "company-a" } });
    expect(tx.companySettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-a" } }),
    );
    expect(tx.campaign.createMany).toHaveBeenCalled();
    expect(tx.order.create).toHaveBeenCalledTimes(2);
  });

  it("blocks demo reset for non-sandbox companies", async () => {
    const prisma: SandboxPrismaCtor = {
      companySettings: {
        findUnique: jest.fn().mockResolvedValue({ sandboxMode: false }),
      },
      $transaction: jest.fn(),
    };
    const reservations: SandboxReservationsMock = { confirm: jest.fn() };
    const service = new SandboxService(prisma as never as PrismaService, reservations as StockReservationService);

    await expect(service.resetDemoSnapshot("company-real")).rejects.toThrow(
      "demo_mode_reset_disabled_for_non_sandbox_company",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
