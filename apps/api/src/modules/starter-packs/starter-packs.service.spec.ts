import { StarterPacksService } from "./starter-packs.service";

describe("StarterPacksService", () => {
  it("applies catalog pack", async () => {
    const prisma = {
      category: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "c1" }),
      },
      attributeDefinition: {
        upsert: jest.fn().mockResolvedValue({ id: "a1" }),
      },
    } as any;

    const service = new StarterPacksService(prisma);
    await service.applyCatalog("co1");
    expect(prisma.category.create).toHaveBeenCalled();
    expect(prisma.attributeDefinition.upsert).toHaveBeenCalled();
  });

  it("applies templates pack", async () => {
    const prisma = {
      emailTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "e1" }),
      },
      dashboardTemplate: { create: jest.fn().mockResolvedValue({ id: "d1" }) },
      reportTemplate: { create: jest.fn().mockResolvedValue({ id: "r1" }) },
    } as any;

    const service = new StarterPacksService(prisma);
    await service.applyTemplates("co1");
    expect(prisma.emailTemplate.create).toHaveBeenCalled();
    expect(prisma.dashboardTemplate.create).toHaveBeenCalled();
    expect(prisma.reportTemplate.create).toHaveBeenCalled();
  });
});
