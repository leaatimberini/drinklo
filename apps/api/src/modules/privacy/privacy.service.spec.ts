import { PrivacyService } from "./privacy.service";

describe("PrivacyService", () => {
  it("anonymizes customer and logs request", async () => {
    const prisma = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
      address: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      privacyRequest: { create: jest.fn().mockResolvedValue({ id: "p1" }) },
      $transaction: async (fn: any) => fn(prisma),
      companySettings: {
        findUnique: jest.fn().mockResolvedValue({ retentionLogsDays: 90 }),
        update: jest.fn().mockResolvedValue({ retentionLogsDays: 30 }),
      },
    } as any;

    const service = new PrivacyService(prisma);
    await service.anonymizeCustomer("co", "c1", "u1", "note");
    expect(prisma.privacyRequest.create).toHaveBeenCalled();
  });
});
