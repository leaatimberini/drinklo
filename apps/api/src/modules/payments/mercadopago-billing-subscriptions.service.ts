import { Injectable } from "@nestjs/common";
import { Prisma, SubscriptionStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { SecretsService } from "../secrets/secrets.service";
import { SandboxService } from "../sandbox/sandbox.service";
import { PlansService } from "../plans/plans.service";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";
import { MercadoPagoAdapter } from "./adapters/mercadopago.adapter";
import { addDaysPreservingBuenosAiresWallClock } from "../plans/plan-time.util";

type MpTopic =
  | "preapproval"
  | "subscription_preapproval"
  | "authorized_payment"
  | "subscription_authorized_payment"
  | "payment"
  | string;

type PaymentLike = {
  id?: string | number;
  status?: string;
  preapproval_id?: string | number;
  date_approved?: string;
  metadata?: any;
  external_reference?: string;
};

@Injectable()
export class MercadoPagoBillingSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
    private readonly sandbox: SandboxService,
    private readonly plans: PlansService,
    private readonly audit: ImmutableAuditService,
  ) {}

  private async adapter(companyId: string) {
    const secret = await this.secrets.getSecret(companyId, "MERCADOPAGO");
    const accessToken = secret?.accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN is required");
    }
    return new MercadoPagoAdapter({ accessToken });
  }

  private normalizeMpStatus(value: any) {
    return String(value ?? "").toLowerCase();
  }

  private buildNextBillingFrom(baseDate: Date) {
    return addDaysPreservingBuenosAiresWallClock(baseDate, 30);
  }

  private async auditSubscriptionChange(
    companyId: string,
    subscriptionId: string,
    action: string,
    payload: Record<string, any>,
  ) {
    await this.audit.append({
      companyId,
      category: "billing",
      action,
      method: "WEBHOOK",
      route: "/webhooks/mercadopago",
      statusCode: 200,
      actorUserId: null,
      actorRole: "system",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      payload,
    });
  }

  async getStatus(companyId: string) {
    const subscription = await this.plans.getSubscription(companyId);
    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentTier: subscription.currentTier,
        mpPreapprovalId: subscription.mpPreapprovalId,
        mpPreapprovalStatus: subscription.mpPreapprovalStatus,
        mpNextBillingDate: subscription.mpNextBillingDate,
        lastPaymentAt: subscription.lastPaymentAt,
      },
    };
  }

  async createOrUpdatePreapproval(
    companyId: string,
    options?: {
      allowDuringTrial?: boolean;
      activate?: boolean;
      targetTier?: "C1" | "C2" | "C3";
      actorUserId?: string;
    },
  ) {
    const subscription = await this.plans.getSubscription(companyId);
    if (subscription.status === "TRIAL_ACTIVE" && !options?.allowDuringTrial) {
      return { ok: true, skipped: "trial_active", subscription };
    }

    const [catalog, settings, company, admin] = await Promise.all([
      this.plans.getPlanCatalog(),
      this.prisma.companySettings.findUnique({ where: { companyId } }),
      this.prisma.company.findUnique({ where: { id: companyId } }),
      this.prisma.user.findFirst({
        where: {
          companyId,
          deletedAt: null,
          role: { name: { equals: "Admin", mode: "insensitive" } },
        },
        select: { email: true },
      }),
    ]);
    const tier = (options?.targetTier ?? subscription.currentTier) as "C1" | "C2" | "C3";
    const entitlement = catalog.find((item: any) => item.tier === tier);
    if (!entitlement) {
      throw new Error(`Entitlement not found for tier ${tier}`);
    }
    const amount = Number(entitlement.monthlyPriceArs ?? 0);
    const currency = settings?.currency ?? "ARS";
    const reason = `${company?.name ?? "Company"} - Plan ${tier}`;
    const isSandbox = Boolean(settings?.sandboxMode);

    let response: any;
    if (isSandbox) {
      response = this.sandbox.deterministicPreapproval(companyId, amount, tier);
    } else {
      const adapter = await this.adapter(companyId);
      const payload = {
        reason,
        external_reference: companyId,
        payer_email: admin?.email,
        back_url: process.env.MERCADOPAGO_BILLING_BACK_URL ?? process.env.MERCADOPAGO_SUCCESS_URL,
        status: options?.activate ? ("authorized" as const) : ("pending" as const),
        auto_recurring: {
          frequency: 1,
          frequency_type: "months" as const,
          transaction_amount: amount,
          currency_id: currency,
          start_date: new Date().toISOString(),
        },
      };
      response = subscription.mpPreapprovalId
        ? await adapter.updatePreapproval(subscription.mpPreapprovalId, payload as any)
        : await adapter.createPreapproval(payload);
    }

    const updated = await this.prisma.subscription.update({
      where: { companyId },
      data: {
        billingProvider: "MERCADOPAGO",
        mpPreapprovalId: String(response.id ?? subscription.mpPreapprovalId ?? ""),
        mpPreapprovalStatus: String(response.status ?? "pending"),
        mpNextBillingDate: response.next_payment_date ? new Date(response.next_payment_date) : undefined,
        mpSubscriptionRaw: response as any,
      },
    });

    await this.auditSubscriptionChange(companyId, updated.id, "subscription.mp_preapproval.upsert", {
      tier,
      amount,
      currency,
      mpPreapprovalId: updated.mpPreapprovalId,
      mpPreapprovalStatus: updated.mpPreapprovalStatus,
      actorUserId: options?.actorUserId ?? null,
      sandbox: isSandbox,
    });

    return { ok: true, subscription: updated, preapproval: response };
  }

  async handlePreapprovalWebhook(params: {
    companyId?: string | null;
    dataId?: string;
    body?: any;
    topic?: MpTopic;
  }) {
    const dataId = String(params.dataId ?? "");
    let subscription =
      (dataId
        ? await this.prisma.subscription.findFirst({
            where: { mpPreapprovalId: dataId },
          })
        : null) ??
      (params.companyId
        ? await this.prisma.subscription.findUnique({ where: { companyId: params.companyId } })
        : null);
    if (!subscription) {
      return { handled: false, reason: "subscription_not_found" };
    }
    const companyId = subscription.companyId;
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId } });
    let preapproval: any;
    if (settings?.sandboxMode) {
      const catalog = await this.plans.getPlanCatalog();
      const entitlement = catalog.find((item: any) => item.tier === subscription!.currentTier);
      preapproval = this.sandbox.deterministicPreapproval(companyId, Number(entitlement?.monthlyPriceArs ?? 0), String(subscription.currentTier));
      preapproval.id = subscription.mpPreapprovalId ?? preapproval.id;
    } else {
      const adapter = await this.adapter(companyId);
      preapproval = await adapter.getPreapproval(dataId || String(subscription.mpPreapprovalId ?? ""));
    }

    const mpStatus = this.normalizeMpStatus(preapproval?.status);
    let nextStatus: SubscriptionStatus | undefined;
    if (["paused", "cancelled", "canceled"].includes(mpStatus)) {
      nextStatus = this.resolveFailureStatus(subscription, new Date());
    } else if (["authorized"].includes(mpStatus) && subscription.status === "RESTRICTED") {
      nextStatus = "GRACE";
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        billingProvider: "MERCADOPAGO",
        mpPreapprovalId: String(preapproval.id ?? subscription.mpPreapprovalId ?? ""),
        mpPreapprovalStatus: String(preapproval.status ?? subscription.mpPreapprovalStatus ?? "pending"),
        mpNextBillingDate: preapproval.next_payment_date ? new Date(preapproval.next_payment_date) : undefined,
        mpSubscriptionRaw: preapproval as any,
        status: nextStatus,
        graceEndAt:
          nextStatus && (nextStatus === "PAST_DUE" || nextStatus === "GRACE")
            ? subscription.graceEndAt ?? addDaysPreservingBuenosAiresWallClock(new Date(), 7)
            : undefined,
      },
    });
    if (nextStatus && nextStatus !== subscription.status) {
      await this.auditSubscriptionChange(companyId, updated.id, "subscription.mp_preapproval.status_sync", {
        fromStatus: subscription.status,
        toStatus: nextStatus,
        mpStatus,
      });
    }
    return { handled: true, companyId, subscription: updated, mpStatus };
  }

  async tryHandleRecurringPaymentWebhook(params: {
    payment: PaymentLike;
    paymentId?: string;
    companyIdHint?: string | null;
  }) {
    const preapprovalId = params.payment.preapproval_id ? String(params.payment.preapproval_id) : null;
    if (!preapprovalId) {
      return { handled: false };
    }
    const subscription = await this.prisma.subscription.findFirst({
      where: { mpPreapprovalId: preapprovalId },
    });
    if (!subscription) {
      return { handled: false };
    }

    const paymentStatus = this.normalizeMpStatus(params.payment.status);
    const approved = ["approved", "accredited", "authorized"].includes(paymentStatus);
    const failed = ["rejected", "cancelled", "canceled", "charged_back", "refunded"].includes(paymentStatus);
    if (!approved && !failed) {
      return { handled: true, ignored: true, companyId: subscription.companyId };
    }

    const now = new Date();
    let nextStatus = subscription.status;
    const data: any = {
      billingProvider: "MERCADOPAGO",
      mpPreapprovalId: preapprovalId,
    };
    if (approved) {
      nextStatus = "ACTIVE_PAID";
      const approvedAt = params.payment.date_approved ? new Date(params.payment.date_approved) : now;
      data.status = "ACTIVE_PAID";
      data.lastPaymentAt = approvedAt;
      data.graceEndAt = null;
      data.softLimited = false;
      data.softLimitReason = null;
      data.softLimitSnapshot = Prisma.JsonNull;
      data.currentPeriodStart = approvedAt;
      data.currentPeriodEnd = this.buildNextBillingFrom(approvedAt);
      data.mpPreapprovalStatus = "authorized";
      data.mpNextBillingDate = this.buildNextBillingFrom(approvedAt);
    } else if (failed) {
      nextStatus = this.resolveFailureStatus(subscription, now);
      data.status = nextStatus;
      data.mpPreapprovalStatus = paymentStatus;
      if (nextStatus === "PAST_DUE" || nextStatus === "GRACE") {
        data.graceEndAt = subscription.graceEndAt ?? addDaysPreservingBuenosAiresWallClock(now, 7);
      }
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data,
    });

    if (nextStatus !== subscription.status || approved || failed) {
      await this.auditSubscriptionChange(subscription.companyId, subscription.id, "subscription.mp_recurring_payment", {
        paymentId: params.paymentId ?? String(params.payment.id ?? ""),
        paymentStatus,
        preapprovalId,
        fromStatus: subscription.status,
        toStatus: updated.status,
      });
    }

    return { handled: true, companyId: subscription.companyId, subscription: updated };
  }

  private resolveFailureStatus(subscription: {
    status: SubscriptionStatus;
    graceEndAt: Date | null;
  }, now: Date): SubscriptionStatus {
    if (subscription.status === "GRACE") {
      if (subscription.graceEndAt && subscription.graceEndAt <= now) return "RESTRICTED";
      return "GRACE";
    }
    if (subscription.status === "PAST_DUE") return "GRACE";
    return "PAST_DUE";
  }
}

