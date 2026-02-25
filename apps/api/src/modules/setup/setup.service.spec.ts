import { ConflictException } from "@nestjs/common";
import { SetupService } from "./setup.service";
import { addDaysPreservingBuenosAiresWallClock } from "../plans/plan-time.util";

const prismaMock = {
  company: {
    count: jest.fn(),
    create: jest.fn(),
  },
  companySettings: {
    create: jest.fn(),
  },
  planEntitlement: {
    upsert: jest.fn(),
  },
  permission: {
    create: jest.fn(),
  },
  role: {
    create: jest.fn(),
  },
  rolePermission: {
    create: jest.fn(),
  },
  user: {
    create: jest.fn(),
  },
  branch: {
    create: jest.fn(),
  },
  subscription: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const dto = {
  companyName: "Acme",
  brandName: "Acme",
  domain: "acme.local",
  adminName: "Admin",
  adminEmail: "admin@acme.local",
  adminPassword: "admin123",
};

describe("SetupService", () => {
  let service: SetupService;

  beforeEach(() => {
    service = new SetupService(prismaMock as any);
    prismaMock.company.count.mockReset();
  });

  it("blocks initialize when company exists", async () => {
    prismaMock.company.count.mockResolvedValue(1);

    await expect(service.initialize(dto)).rejects.toThrow(ConflictException);
  });

  it("allows initialize when no company exists", async () => {
    prismaMock.company.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        planEntitlement: { upsert: jest.fn().mockResolvedValue(null) },
        company: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
        companySettings: { create: jest.fn() },
        branch: { create: jest.fn().mockResolvedValue({ id: "b1" }) },
        permission: { create: jest.fn().mockResolvedValue({ id: "p1", code: "products:read" }) },
        role: { create: jest.fn().mockResolvedValue({ id: "r1", name: "Admin" }) },
        rolePermission: { create: jest.fn() },
        user: { create: jest.fn().mockResolvedValue({ id: "u1" }) },
        subscription: { create: jest.fn().mockResolvedValue({ id: "s1" }) },
        $transaction: jest.fn(async (ops: any[]) => Promise.all(ops.map((op) => op))),
      };
      return cb(tx);
    });

    const result = await service.initialize(dto);

    expect(result.companyId).toBe("c1");
    expect(result.adminId).toBe("u1");
  });

  it("computes trial end preserving Buenos Aires wall clock (+30d)", () => {
    const base = new Date("2026-02-25T13:45:00.000Z"); // 10:45 BA
    const trialEnd = addDaysPreservingBuenosAiresWallClock(base, 30);

    expect(trialEnd.toISOString()).toBe("2026-03-27T13:45:00.000Z");
  });
});
