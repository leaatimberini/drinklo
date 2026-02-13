import { EventsService } from "./events.service";

describe("EventsService.getFeatureUsage", () => {
  it("returns aggregated feature usage rows", async () => {
    jest.useFakeTimers();

    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([
        { feature: "pos", action: "view", count: 3n },
        { feature: "bot", action: "command", count: 2n },
      ]),
      eventLog: {
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const service = new EventsService(prisma);
    const res: any = await service.getFeatureUsage({
      companyId: "c1",
      from: "2026-02-12T00:00:00.000Z",
      to: "2026-02-12T01:00:00.000Z",
    });

    expect(res.ok).toBe(true);
    expect(res.items).toEqual([
      { feature: "pos", action: "view", count: 3 },
      { feature: "bot", action: "command", count: 2 },
    ]);

    jest.useRealTimers();
  });

  it("rejects invalid time range", async () => {
    jest.useFakeTimers();
    const prisma: any = {
      $queryRaw: jest.fn(),
      eventLog: {
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new EventsService(prisma);
    const res: any = await service.getFeatureUsage({
      companyId: "c1",
      from: "bad",
      to: "also-bad",
    });
    expect(res.ok).toBe(false);
    jest.useRealTimers();
  });
});

