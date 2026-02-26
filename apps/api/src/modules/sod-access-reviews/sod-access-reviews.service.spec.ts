import { SodPolicyMode } from "@erp/db";
import { SodAccessReviewsService } from "./sod-access-reviews.service";

function makeConfig(values?: Record<string, unknown>) {
  return {
    get: (key: string) => values?.[key],
  } as unknown;
}

function makePrisma(overrides?: Partial<unknown>) {
  const prisma: unknown = {
    sodPolicy: {
      count: jest.fn().mockResolvedValue(2),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([
        {
          id: "p1",
          companyId: "co1",
          code: "pricing_vs_purchase_approve",
          name: "pricing vs purchase approve",
          actionA: "PRICING_CONFIGURE",
          actionB: "PURCHASE_APPROVE",
          mode: SodPolicyMode.DENY,
          enabled: true,
        },
      ]),
      upsert: jest.fn(),
    },
    sodViolationEvent: {
      create: jest.fn().mockResolvedValue({ id: "v1" }),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    accessReviewCampaign: {
      create: jest.fn().mockResolvedValue({ id: "c1" }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: "c1",
        companyId: "co1",
        name: "Access Review Monthly",
        cadence: "MONTHLY",
        status: "OPEN",
        dueAt: new Date("2026-03-15T00:00:00Z"),
        createdAt: new Date("2026-03-01T00:00:00Z"),
        summary: null,
        _count: { items: 2 },
      }),
      update: jest.fn().mockResolvedValue({ id: "c1" }),
      count: jest.fn().mockResolvedValue(1),
    },
    accessReviewItem: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([{ decision: "PENDING", _count: { _all: 2 } }]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "u1",
          companyId: "co1",
          roleId: "r1",
          role: {
            name: "admin",
            rolePermissions: [{ permission: { code: "users:write" } }, { permission: { code: "pricing:write" } }],
          },
        },
        {
          id: "u2",
          companyId: "co1",
          roleId: "r2",
          role: {
            name: "manager",
            rolePermissions: [],
          },
        },
      ]),
    },
    $transaction: jest.fn(async (cb: unknown) => cb(prisma)),
    ...overrides,
  };
  return prisma;
}

describe("SodAccessReviewsService", () => {
  it("denies conflicting SoD actions and records violation", async () => {
    const prisma = makePrisma();
    const service = new SodAccessReviewsService(prisma, makeConfig());

    const result = await service.evaluateAndRecord({
      companyId: "co1",
      userId: "u1",
      permissions: ["pricing:write", "inventory:write"],
      requestAction: "PRICING_CONFIGURE",
      route: "/admin/taxes/rules",
      method: "PUT",
    });

    expect(result.allowed).toBe(false);
    expect(prisma.sodViolationEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.sodViolationEvent.create.mock.calls[0][0].data.outcome).toBe("DENIED");
  });

  it("creates access review campaign with snapshot items", async () => {
    const prisma = makePrisma({
      sodPolicy: { ...makePrisma().sodPolicy, count: jest.fn().mockResolvedValue(0), createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    });
    const service = new SodAccessReviewsService(prisma, makeConfig());

    const campaign = await service.createAccessReviewCampaign(
      "co1",
      { cadence: "MONTHLY", name: "Review marzo" },
      "admin1",
    );

    expect(prisma.accessReviewCampaign.create).toHaveBeenCalledTimes(1);
    expect(prisma.accessReviewItem.createMany).toHaveBeenCalledTimes(1);
    const payload = prisma.accessReviewItem.createMany.mock.calls[0][0].data;
    expect(payload).toHaveLength(2);
    expect(payload[0].permissionCodes).toBeDefined();
    expect(campaign.id).toBe("c1");
  });
});
