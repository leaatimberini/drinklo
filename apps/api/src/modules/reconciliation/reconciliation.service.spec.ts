import { ReconciliationService } from "./reconciliation.service";

describe("ReconciliationService", () => {
  it("alerts when order paid without payment", async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: "o1", status: "PAID", shippingCost: 0 },
        ]),
      },
      sale: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown;

    const service = new ReconciliationService(prisma);
    const report = await service.report("c1");
    expect(report.alerts.length).toBeGreaterThan(0);
  });
});
