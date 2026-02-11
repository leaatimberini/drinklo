import { AbTestingService } from "./ab-testing.service";
import { ExperimentStatus, ExperimentTarget } from "@erp/db";

describe("AbTestingService", () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1", settings: { enableAbTesting: true } }) },
      experiment: { findFirst: jest.fn() },
      experimentAssignment: { upsert: jest.fn() },
      experimentEvent: { create: jest.fn() },
      ...overrides,
    };
    return { service: new AbTestingService(prisma as any), prisma };
  }

  it("assigns stable variant based on cookie", async () => {
    const { service, prisma } = buildService();
    prisma.experiment.findFirst.mockResolvedValue({
      id: "e1",
      name: "Home Test",
      target: ExperimentTarget.HOME,
      status: ExperimentStatus.ACTIVE,
      variants: [
        { id: "v1", weight: 0.5 },
        { id: "v2", weight: 0.5 },
      ],
    });

    const cookie = JSON.stringify({ id: "cookie-1", assignments: { e1: "v2" } });
    const result = await service.assign("c1", ExperimentTarget.HOME, cookie, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variant.id).toBe("v2");
    }
  });
});
