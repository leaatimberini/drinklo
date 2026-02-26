import { DomainEmailService } from "./domain-email.service";

const makeService = () => {
  const prisma = {
    emailDomain: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "d1", status: "VERIFIED" }),
      upsert: jest.fn().mockResolvedValue({ id: "d1" }),
      update: jest.fn().mockResolvedValue({ id: "d1", status: "VERIFIED" }),
    },
    emailEventLog: {
      create: jest.fn().mockResolvedValue({ id: "e1" }),
    },
  };

  return { service: new DomainEmailService(prisma as never), prisma };
};

describe("DomainEmailService", () => {
  it("upserts domain", async () => {
    const { service, prisma } = makeService();
    await service.upsert("c1", { providerType: "SMTP", domain: "example.com" } as never);
    expect(prisma.emailDomain.upsert).toHaveBeenCalled();
  });

  it("confirms domain", async () => {
    const { service, prisma } = makeService();
    prisma.emailDomain.findUnique.mockResolvedValue({ id: "d1", companyId: "c1" });
    await service.confirm("c1", true, "u1");
    expect(prisma.emailDomain.update).toHaveBeenCalled();
  });

  it("records event", async () => {
    const { service, prisma } = makeService();
    await service.recordEvent("c1", { type: "bounce" } as never, { raw: true });
    expect(prisma.emailEventLog.create).toHaveBeenCalled();
  });
});
