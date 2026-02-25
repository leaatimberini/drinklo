import { MercadoPagoBillingSubscriptionsService } from "./mercadopago-billing-subscriptions.service";
import { MercadoPagoAdapter } from "./adapters/mercadopago.adapter";

describe("MercadoPagoBillingSubscriptionsService", () => {
  const prisma: any = {
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    companySettings: { findUnique: jest.fn() },
    company: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  const secrets = { getSecret: jest.fn() };
  const sandbox = { deterministicPreapproval: jest.fn() };
  const plans = {
    getSubscription: jest.fn(),
    getPlanCatalog: jest.fn(),
  };
  const audit = { append: jest.fn() };

  beforeEach(() => {
    jest.restoreAllMocks();
    for (const delegate of Object.values(prisma) as any[]) {
      Object.values(delegate).forEach((fn: any) => fn?.mockReset?.());
    }
    secrets.getSecret.mockReset();
    sandbox.deterministicPreapproval.mockReset();
    plans.getSubscription.mockReset();
    plans.getPlanCatalog.mockReset();
    audit.append.mockReset();
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });

  it("skips preapproval creation during trial unless allowed", async () => {
    const service = new MercadoPagoBillingSubscriptionsService(
      prisma,
      secrets as any,
      sandbox as any,
      plans as any,
      audit as any,
    );
    plans.getSubscription.mockResolvedValue({
      id: "s1",
      companyId: "c1",
      status: "TRIAL_ACTIVE",
      currentTier: "C1",
    });

    const result = await service.createOrUpdatePreapproval("c1");

    expect(result.skipped).toBe("trial_active");
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it("creates preapproval using mocked MP API and stores ids/status", async () => {
    const service = new MercadoPagoBillingSubscriptionsService(
      prisma,
      secrets as any,
      sandbox as any,
      plans as any,
      audit as any,
    );
    plans.getSubscription.mockResolvedValue({
      id: "s1",
      companyId: "c1",
      status: "ACTIVE_PAID",
      currentTier: "C2",
      mpPreapprovalId: null,
    });
    plans.getPlanCatalog.mockResolvedValue([{ tier: "C2", monthlyPriceArs: 149900 }]);
    prisma.companySettings.findUnique.mockResolvedValue({ companyId: "c1", sandboxMode: false, currency: "ARS" });
    prisma.company.findUnique.mockResolvedValue({ id: "c1", name: "Acme" });
    prisma.user.findFirst.mockResolvedValue({ email: "admin@acme.local" });
    prisma.subscription.update.mockResolvedValue({
      id: "s1",
      companyId: "c1",
      mpPreapprovalId: "mp-pre-1",
      mpPreapprovalStatus: "authorized",
    });
    secrets.getSecret.mockResolvedValue({ accessToken: "mp_test_123" });
    jest.spyOn(MercadoPagoAdapter.prototype, "createPreapproval").mockResolvedValueOnce({
      id: "mp-pre-1",
      status: "authorized",
      next_payment_date: "2026-04-01T03:00:00.000Z",
    } as any);

    const result = await service.createOrUpdatePreapproval("c1", { activate: true });

    expect(result.ok).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "c1" },
        data: expect.objectContaining({
          billingProvider: "MERCADOPAGO",
          mpPreapprovalId: "mp-pre-1",
          mpPreapprovalStatus: "authorized",
        }),
      }),
    );
  });

  it("maps recurring payment approval and failures to subscription states", async () => {
    const service = new MercadoPagoBillingSubscriptionsService(
      prisma,
      secrets as any,
      sandbox as any,
      plans as any,
      audit as any,
    );
    prisma.subscription.findFirst.mockResolvedValueOnce({
      id: "s1",
      companyId: "c1",
      status: "TRIAL_ACTIVE",
      graceEndAt: null,
      mpPreapprovalId: "mp-pre-1",
    });
    prisma.subscription.update.mockResolvedValueOnce({
      id: "s1",
      companyId: "c1",
      status: "ACTIVE_PAID",
    });

    const approved = await service.tryHandleRecurringPaymentWebhook({
      payment: { id: "pay1", preapproval_id: "mp-pre-1", status: "approved", date_approved: "2026-03-01T03:00:00.000Z" },
      paymentId: "pay1",
    });
    expect(approved.handled).toBe(true);
    expect(prisma.subscription.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE_PAID" }) }),
    );

    prisma.subscription.findFirst.mockResolvedValueOnce({
      id: "s1",
      companyId: "c1",
      status: "ACTIVE_PAID",
      graceEndAt: null,
      mpPreapprovalId: "mp-pre-1",
    });
    prisma.subscription.update.mockResolvedValueOnce({
      id: "s1",
      companyId: "c1",
      status: "PAST_DUE",
    });
    const failed = await service.tryHandleRecurringPaymentWebhook({
      payment: { id: "pay2", preapproval_id: "mp-pre-1", status: "rejected" },
      paymentId: "pay2",
    });

    expect(failed.handled).toBe(true);
    expect(prisma.subscription.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ status: "PAST_DUE" }) }),
    );
  });
});
