import { DomainEmailService } from "./domain-email.service";

const makeService = () => {
  const prisma = {
    emailDomain: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "d1" }),
      update: jest.fn().mockResolvedValue({ id: "d1", status: "VERIFIED" }),
    },
    emailEventLog: {
      create: jest.fn().mockResolvedValue({ id: "e1" }),
    },
  } as any;

  return { service: new DomainEmailService(prisma), prisma };
};

describe("DomainEmailService", () => {
  it("upserts domain", async () => {
    const { service, prisma } = makeService();
    await service.upsert("c1", { providerType: "SMTP", domain: "example.com" } as any);
    expect(prisma.emailDomain.upsert).toHaveBeenCalled();
  });

  it("confirms domain", async () => {
    const { service, prisma } = makeService();
    await service.confirm("c1", true, "u1");
    expect(prisma.emailDomain.update).toHaveBeenCalled();
  });

  it("records event", async () => {
    const { service, prisma } = makeService();
    await service.recordEvent("c1", { type: "bounce" } as any, { raw: true });
    expect(prisma.emailEventLog.create).toHaveBeenCalled();
  });
});
