import { MercadoPagoWebhookController } from "./mercadopago.webhook.controller";

describe("MercadoPagoWebhookController (recurring billing)", () => {
  const prisma = {
    webhookLog: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
    },
  };
  const payments = {
    getPayment: jest.fn(),
    updatePaymentStatus: jest.fn(),
  };
  const recurringBilling = {
    handlePreapprovalWebhook: jest.fn(),
    tryHandleRecurringPaymentWebhook: jest.fn(),
  };
  const secrets = { getSecret: jest.fn() };
  const metrics = { recordWebhook: jest.fn(), recordWebhookRetry: jest.fn() };
  const fraud = { recordWebhookSignal: jest.fn() };

  beforeEach(() => {
    Object.values(prisma.webhookLog).forEach((fn: unknown) => fn.mockReset());
    Object.values(prisma.company).forEach((fn: unknown) => fn.mockReset());
    Object.values(payments).forEach((fn: unknown) => fn.mockReset());
    Object.values(recurringBilling).forEach((fn: unknown) => fn.mockReset());
    Object.values(secrets).forEach((fn: unknown) => fn.mockReset());
    Object.values(metrics).forEach((fn: unknown) => fn.mockReset());
    Object.values(fraud).forEach((fn: unknown) => fn.mockReset());
  });

  it("deduplicates repeated preapproval webhooks", async () => {
    const controller = new MercadoPagoWebhookController(
      prisma,
      payments as never,
      recurringBilling as never,
      secrets as never,
      metrics as never,
      fraud as never,
    );
    prisma.company.findFirst.mockResolvedValue({ id: "c1" });
    prisma.webhookLog.create.mockResolvedValueOnce({ id: "w1" }).mockRejectedValueOnce(new Error("duplicate"));
    secrets.getSecret.mockResolvedValue(null);
    recurringBilling.handlePreapprovalWebhook.mockResolvedValue({
      handled: true,
      companyId: "c1",
    });
    prisma.webhookLog.update.mockResolvedValue({});
    prisma.webhookLog.updateMany.mockResolvedValue({ count: 1 });

    const body = { topic: "preapproval", data: { id: "pre_123" } };
    const first = await controller.handle(body, undefined, undefined, { "data.id": "pre_123" });
    const second = await controller.handle(body, undefined, undefined, { "data.id": "pre_123" });

    expect(first.ok).toBe(true);
    expect(first.recurring).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(recurringBilling.handlePreapprovalWebhook).toHaveBeenCalledTimes(1);
  });
});

