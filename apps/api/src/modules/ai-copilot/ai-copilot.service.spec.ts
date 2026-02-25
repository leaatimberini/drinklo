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

  const ops = {
    getSnapshot: jest.fn(),
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
    ops.getSnapshot.mockResolvedValue({
      errors: [
        { id: "e1", message: "Redis timeout", route: "/admin/ops", requestId: "r1" },
        { id: "e2", message: "Webhook duplicated", route: "/api/webhook", requestId: "r2" },
      ],
      jobFailures: [{ id: "j1", queue: "default", name: "retry", reason: "timeout" }],
      secrets: { expired: 0, unverified: 0 },
    });
  });

  it("requires explicit approval before executing action", async () => {
    const service = new AiCopilotService(prisma, audit, ops);

    const response = await service.chat(userBase as any, "crear cupon del 10", "admin");

    expect(response.approvalRequired).toBe(true);
    expect(response.proposals.length).toBeGreaterThan(0);
    expect(prisma.coupon.create).not.toHaveBeenCalled();
  });

  it("enforces permissions on approve", async () => {
    const service = new AiCopilotService(prisma, audit, ops);
    const user = { ...userBase, permissions: ["products:read"] };

    await expect(service.approveProposal(user as any, "p1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("generates immutable audit on approved execution", async () => {
    const service = new AiCopilotService(prisma, audit, ops);

    const result = await service.approveProposal(userBase as any, "p1", "ok");

    expect(result.execution.ok).toBe(true);
    expect(prisma.coupon.create).toHaveBeenCalledTimes(1);
    expect(audit.append).toHaveBeenCalledTimes(1);
  });

  it("returns explain-and-cite references in chat responses", async () => {
    const service = new AiCopilotService(prisma, audit, ops);

    const response = await service.chat(userBase as any, "necesito ayuda con backups y deploy", "admin");

    expect(Array.isArray(response.citations)).toBe(true);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.message).toContain("Referencias internas");
  });

  it("enforces incident RAG scopes for non privileged users", async () => {
    const service = new AiCopilotService(prisma, audit, ops);
    const user = {
      ...userBase,
      role: "caja",
      permissions: ["products:read"],
    };

    const response = await service.chat(user as any, "incidente redis caido, sugeri runbook", "incident");

    expect(response.message).toContain("Sin permiso para modo incidentes");
    expect(response.proposals).toHaveLength(0);
  });

  it("creates incident action proposal and executes only after approval", async () => {
    prisma.aiCopilotProposal.create.mockResolvedValueOnce({
      id: "p_inc",
      companyId: "c1",
      actionType: "RUN_INCIDENT_PLAYBOOK",
      requiredPermission: "settings:write",
      status: "PENDING",
      preview: { actionType: "RUN_INCIDENT_PLAYBOOK", details: { runbook: { docId: "RUNBOOKS", section: "DB" } } },
    });
    prisma.aiCopilotProposal.findFirst.mockResolvedValueOnce({
      id: "p_inc",
      companyId: "c1",
      actionType: "RUN_INCIDENT_PLAYBOOK",
      requiredPermission: "settings:write",
      status: "PENDING",
      preview: { actionType: "RUN_INCIDENT_PLAYBOOK", details: { runbook: { docId: "RUNBOOKS", section: "DB" } } },
    });
    const service = new AiCopilotService(prisma, audit, ops);
    const user = { ...userBase, permissions: [...userBase.permissions, "settings:write"] };

    const chat = await service.chat(user as any, "incidente redis timeout, sugeri runbook y mitigar", "incident");

    expect(chat.approvalRequired).toBe(true);
    expect(chat.proposals.some((p: any) => p.actionType === "RUN_INCIDENT_PLAYBOOK")).toBe(true);
    expect(prisma.coupon.create).not.toHaveBeenCalled();

    const approved = await service.approveProposal(user as any, "p_inc", "approved_incident_action");

    expect(approved.execution.ok).toBe(true);
    expect(approved.execution.resource).toBe("incidentPlaybook");
    expect(approved.execution.manualRequired).toBe(true);
    expect(audit.append).toHaveBeenCalled();
  });
});
