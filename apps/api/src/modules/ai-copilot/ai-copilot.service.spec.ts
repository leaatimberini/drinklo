import { ForbiddenException } from "@nestjs/common";
import { AiCopilotService } from "./ai-copilot.service";

describe("AiCopilotService", () => {
  const prisma = {
    aiCopilotProposal: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    aiCopilotLog: {
      create: jest.fn(),
    },
    coupon: {
      create: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    productVariant: {
      findFirst: jest.fn(),
    },
    purchaseOrder: {
      create: jest.fn(),
      count: jest.fn(),
    },
    purchaseOrderItem: {
      create: jest.fn(),
    },
    stockItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    customer: {
      count: jest.fn(),
    },
    campaign: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  } as any;

  const audit = {
    append: jest.fn().mockResolvedValue(undefined),
  } as any;

  const userBase = {
    sub: "u1",
    companyId: "c1",
    role: "admin",
    permissions: ["products:read", "pricing:read", "pricing:write", "inventory:read", "inventory:write", "customers:read"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.aiCopilotProposal.create.mockResolvedValue({
      id: "p1",
      companyId: "c1",
      actionType: "CREATE_COUPON",
      requiredPermission: "pricing:write",
      status: "PENDING",
      preview: { actionType: "CREATE_COUPON", details: { code: "COPI-123" } },
    });
    prisma.aiCopilotLog.create.mockResolvedValue({ id: "l1" });
    prisma.aiCopilotProposal.findFirst.mockResolvedValue({
      id: "p1",
      companyId: "c1",
      actionType: "CREATE_COUPON",
      requiredPermission: "pricing:write",
      status: "PENDING",
      preview: { actionType: "CREATE_COUPON", details: { code: "COPI-123", amount: 10, type: "PERCENT" } },
    });
    prisma.aiCopilotProposal.update.mockResolvedValue({ id: "p1", status: "EXECUTED" });
    prisma.coupon.create.mockResolvedValue({ id: "cp1", code: "COPI-123" });
    prisma.$queryRaw.mockResolvedValue([{ total: 1000, tickets: 2 }]);
    prisma.stockItem.count.mockResolvedValue(1);
    prisma.customer.count.mockResolvedValue(5);
    prisma.purchaseOrder.count.mockResolvedValue(2);
    prisma.campaign.count.mockResolvedValue(1);
  });

  it("requires explicit approval before executing action", async () => {
    const service = new AiCopilotService(prisma, audit);

    const response = await service.chat(userBase as any, "crear cupon del 10", "admin");

    expect(response.approvalRequired).toBe(true);
    expect(response.proposals.length).toBeGreaterThan(0);
    expect(prisma.coupon.create).not.toHaveBeenCalled();
  });

  it("enforces permissions on approve", async () => {
    const service = new AiCopilotService(prisma, audit);
    const user = { ...userBase, permissions: ["products:read"] };

    await expect(service.approveProposal(user as any, "p1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("generates immutable audit on approved execution", async () => {
    const service = new AiCopilotService(prisma, audit);

    const result = await service.approveProposal(userBase as any, "p1", "ok");

    expect(result.execution.ok).toBe(true);
    expect(prisma.coupon.create).toHaveBeenCalledTimes(1);
    expect(audit.append).toHaveBeenCalledTimes(1);
  });
});
