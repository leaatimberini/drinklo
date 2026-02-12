import { Injectable, NotFoundException } from "@nestjs/common";
import { FraudAction, Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { calculateFraudScore, type FraudRuleCode } from "./scoring";

type RuleConfig = {
  code: FraudRuleCode;
  name: string;
  enabled: boolean;
  weight: number;
  threshold: number | null;
};

type EvaluateOrderContext = {
  ip?: string;
  geoCountry?: string;
  source: "checkout" | "manual" | "webhook";
};

const DEFAULT_RULES: Array<Omit<RuleConfig, "enabled"> & { enabled?: boolean }> = [
  { code: "AMOUNT_UNUSUAL", name: "Monto inusual", weight: 35, threshold: 2.5, enabled: true },
  { code: "ORDER_FREQUENCY", name: "Frecuencia de ordenes", weight: 20, threshold: null, enabled: true },
  { code: "IP_GEO_RISK", name: "IP/Geo inconsistente", weight: 15, threshold: null, enabled: true },
  { code: "MULTIPLE_PAYMENT_FAILURES", name: "Multiples fallos de pago", weight: 20, threshold: 3, enabled: true },
  { code: "WEBHOOK_PATTERN", name: "Patron webhook", weight: 10, threshold: null, enabled: true },
];

@Injectable()
export class FraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  private async getCompanyId() {
    const company = await this.prisma.company.findFirst({ select: { id: true } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return company.id;
  }

  async ensureDefaultRules(companyId: string) {
    const existing = await this.prisma.fraudRule.count({ where: { companyId } });
    if (existing > 0) return;

    await this.prisma.fraudRule.createMany({
      data: DEFAULT_RULES.map((rule) => ({
        companyId,
        code: rule.code,
        name: rule.name,
        enabled: rule.enabled ?? true,
        weight: rule.weight,
        threshold: rule.threshold !== null ? new Prisma.Decimal(rule.threshold) : null,
      })),
    });
  }

  async listRules(companyId?: string) {
    const resolvedCompanyId = companyId ?? (await this.getCompanyId());
    await this.ensureDefaultRules(resolvedCompanyId);
    return this.prisma.fraudRule.findMany({
      where: { companyId: resolvedCompanyId },
      orderBy: { code: "asc" },
    });
  }

  async updateRule(companyId: string, code: string, payload: { enabled?: boolean; weight?: number; threshold?: number }) {
    await this.ensureDefaultRules(companyId);
    return this.prisma.fraudRule.update({
      where: { companyId_code: { companyId, code } },
      data: {
        enabled: payload.enabled,
        weight: payload.weight,
        threshold: payload.threshold !== undefined ? new Prisma.Decimal(payload.threshold) : undefined,
      },
    });
  }

  async queue(companyId: string, status: "OPEN" | "RESOLVED" | "DISMISSED" = "OPEN", limit = 50) {
    return this.prisma.fraudAssessment.findMany({
      where: { companyId, status },
      include: {
        order: { select: { id: true, customerName: true, customerEmail: true, status: true, subtotal: true, shippingCost: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async review(companyId: string, assessmentId: string, status: "RESOLVED" | "DISMISSED", userId: string, note?: string) {
    const assessment = await this.prisma.fraudAssessment.findFirst({ where: { id: assessmentId, companyId } });
    if (!assessment) {
      throw new NotFoundException("Fraud assessment not found");
    }

    const updated = await this.prisma.fraudAssessment.update({
      where: { id: assessmentId },
      data: {
        status,
        reviewedById: userId,
        reviewedAt: new Date(),
        context: {
          ...(assessment.context as Record<string, any> | null),
          reviewNote: note ?? null,
        },
      },
    });

    this.events.enqueue([
      {
        id: `evt-fraud-review-${updated.id}-${Date.now()}`,
        name: "FraudReviewUpdated",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "api",
        companyId,
        subjectId: updated.id,
        payload: { assessmentId: updated.id, status, reviewedById: userId },
      },
    ]);

    return updated;
  }

  private async loadRuleConfig(companyId: string) {
    await this.ensureDefaultRules(companyId);
    const rows = await this.prisma.fraudRule.findMany({ where: { companyId } });

    const map = new Map(rows.map((row) => [row.code, row]));
    const pick = (code: FraudRuleCode) => {
      const rule = map.get(code);
      return {
        enabled: Boolean(rule?.enabled),
        weight: rule?.weight ?? 0,
        threshold: rule?.threshold ? Number(rule.threshold) : null,
      };
    };

    return {
      AMOUNT_UNUSUAL: pick("AMOUNT_UNUSUAL"),
      ORDER_FREQUENCY: pick("ORDER_FREQUENCY"),
      IP_GEO_RISK: pick("IP_GEO_RISK"),
      MULTIPLE_PAYMENT_FAILURES: pick("MULTIPLE_PAYMENT_FAILURES"),
      WEBHOOK_PATTERN: pick("WEBHOOK_PATTERN"),
    };
  }

  private async notifyAlert(payload: Record<string, any>) {
    const controlPlaneWebhook = process.env.CONTROL_PLANE_ALERT_WEBHOOK_URL ?? "";
    const botWebhook = process.env.BOT_ALERT_WEBHOOK_URL ?? "";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.CONTROL_PLANE_ALERT_WEBHOOK_TOKEN) {
      headers.Authorization = `Bearer ${process.env.CONTROL_PLANE_ALERT_WEBHOOK_TOKEN}`;
    }

    if (controlPlaneWebhook) {
      await fetch(controlPlaneWebhook, { method: "POST", headers, body: JSON.stringify(payload) }).catch(() => undefined);
    }
    if (botWebhook) {
      await fetch(botWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => undefined);
    }
  }

  async assessOrderById(orderId: string, context: EvaluateOrderContext) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return this.assessOrder(order.companyId, orderId, context);
  }

  async assessOrder(companyId: string, orderId: string, context: EvaluateOrderContext) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, companyId } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const rules = await this.loadRuleConfig(companyId);
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since1h = new Date(now.getTime() - 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [avgSubtotal, ordersLast1h, ordersLast24h, ipOrderCountLast24h, failedPayments24h, webhookAgg] = await Promise.all([
      this.prisma.order.aggregate({
        where: { companyId, createdAt: { gte: since30d } },
        _avg: { subtotal: true },
      }),
      this.prisma.order.count({ where: { companyId, customerEmail: order.customerEmail, createdAt: { gte: since1h } } }),
      this.prisma.order.count({ where: { companyId, customerEmail: order.customerEmail, createdAt: { gte: since24h } } }),
      context.ip
        ? this.prisma.fraudAssessment.count({
            where: {
              companyId,
              createdAt: { gte: since24h },
              source: "checkout",
              context: {
                path: ["ip"],
                equals: context.ip,
              },
            },
          })
        : Promise.resolve(0),
      this.prisma.payment.count({
        where: {
          order: { companyId, customerEmail: order.customerEmail },
          status: { in: ["REJECTED", "CANCELED"] },
          updatedAt: { gte: since24h },
        },
      }),
      this.prisma.webhookLog.groupBy({
        by: ["status"],
        where: { provider: "mercadopago", receivedAt: { gte: since1h } },
        _count: { _all: true },
      }),
    ]);

    const webhookErrors = webhookAgg.find((row) => row.status === "error")?._count._all ?? 0;
    const webhookDuplicates = webhookAgg.find((row) => row.status === "duplicate")?._count._all ?? 0;

    const weights = {
      AMOUNT_UNUSUAL: rules.AMOUNT_UNUSUAL.enabled ? rules.AMOUNT_UNUSUAL.weight : 0,
      ORDER_FREQUENCY: rules.ORDER_FREQUENCY.enabled ? rules.ORDER_FREQUENCY.weight : 0,
      IP_GEO_RISK: rules.IP_GEO_RISK.enabled ? rules.IP_GEO_RISK.weight : 0,
      MULTIPLE_PAYMENT_FAILURES: rules.MULTIPLE_PAYMENT_FAILURES.enabled ? rules.MULTIPLE_PAYMENT_FAILURES.weight : 0,
      WEBHOOK_PATTERN: rules.WEBHOOK_PATTERN.enabled ? rules.WEBHOOK_PATTERN.weight : 0,
    };

    const scored = calculateFraudScore({
      amount: Number(order.subtotal) + Number(order.shippingCost),
      avgAmount30d: Number(avgSubtotal._avg.subtotal ?? 0),
      ordersLast1h,
      ordersLast24h,
      ipOrderCountLast24h,
      shippingCountry: order.country,
      geoCountry: context.geoCountry ?? null,
      paymentFailuresLast24h: failedPayments24h,
      webhookErrorsLast1h: webhookErrors,
      webhookDuplicatesLast1h: webhookDuplicates,
      weights,
      thresholds: {
        unusualAmountMultiplier: rules.AMOUNT_UNUSUAL.threshold ?? 2.5,
        minUnusualAmount: 25000,
        maxOrders1h: 3,
        maxOrders24h: 8,
        maxPaymentFailures24h: Math.max(1, Number(rules.MULTIPLE_PAYMENT_FAILURES.threshold ?? 3)),
        maxWebhookErrors1h: 5,
        maxWebhookDuplicates1h: 10,
      },
    });

    const triggered = scored.reasons.filter((reason) => reason.triggered);
    const reasonSummary = triggered.length
      ? triggered.map((reason) => `${reason.code}(+${reason.points})`).join(", ")
      : "No risk rules triggered";

    const assessment = await this.prisma.fraudAssessment.create({
      data: {
        companyId,
        orderId,
        score: scored.score,
        riskLevel: scored.riskLevel,
        action: scored.action as FraudAction,
        reasonSummary,
        reasons: scored.reasons,
        source: context.source,
        context: {
          ip: context.ip ?? null,
          geoCountry: context.geoCountry ?? null,
          customerEmail: order.customerEmail,
        },
      },
    });

    if (scored.action === "HOLD_ORDER" || scored.action === "REQUIRE_VERIFICATION") {
      await this.prisma.orderStatusEvent.create({
        data: {
          orderId,
          status: "CREATED",
          message:
            scored.action === "HOLD_ORDER"
              ? `FRAUD_HOLD score=${scored.score} ${reasonSummary}`
              : `FRAUD_VERIFY score=${scored.score} ${reasonSummary}`,
        },
      });
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shippingMeta: {
            ...(order.shippingMeta as Record<string, any> | null),
            fraudHold: scored.action === "HOLD_ORDER",
            fraudVerificationRequired: scored.action === "REQUIRE_VERIFICATION",
            fraudAssessmentId: assessment.id,
          },
        },
      });
    }

    this.events.enqueue([
      {
        id: `evt-fraud-score-${assessment.id}`,
        name: "FraudScored",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "api",
        companyId,
        subjectId: orderId,
        payload: {
          assessmentId: assessment.id,
          orderId,
          score: scored.score,
          riskLevel: scored.riskLevel,
          action: scored.action,
          reasons: scored.reasons,
        },
      },
    ]);

    if (scored.action !== "NONE") {
      const alertPayload = {
        type: "fraud_alert",
        companyId,
        orderId,
        assessmentId: assessment.id,
        score: scored.score,
        riskLevel: scored.riskLevel,
        action: scored.action,
        reasonSummary,
      };

      this.events.enqueue([
        {
          id: `evt-fraud-alert-${assessment.id}`,
          name: "FraudAlertRaised",
          schemaVersion: 1,
          occurredAt: new Date().toISOString(),
          source: "api",
          companyId,
          subjectId: orderId,
          payload: alertPayload,
        },
      ]);

      await this.notifyAlert(alertPayload);
    }

    return assessment;
  }

  async recordWebhookSignal(companyId: string, provider: string, status: string) {
    const since1h = new Date(Date.now() - 60 * 60 * 1000);
    const [errors, duplicates] = await Promise.all([
      this.prisma.webhookLog.count({ where: { provider, status: "error", receivedAt: { gte: since1h } } }),
      this.prisma.webhookLog.count({ where: { provider, status: "duplicate", receivedAt: { gte: since1h } } }),
    ]);

    if (errors < 5 && duplicates < 10) {
      return null;
    }

    const existing = await this.prisma.fraudAssessment.findFirst({
      where: {
        companyId,
        source: "webhook",
        createdAt: { gte: since1h },
        reasonSummary: { contains: provider },
      },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const score = Math.min(100, errors * 8 + duplicates * 2);
    const action = score >= 50 ? FraudAction.NOTIFY_ONLY : FraudAction.NONE;

    const assessment = await this.prisma.fraudAssessment.create({
      data: {
        companyId,
        orderId: null,
        paymentId: null,
        score,
        riskLevel: score >= 50 ? "MEDIUM" : "LOW",
        action,
        reasonSummary: `Webhook pattern anomaly ${provider} errors=${errors} duplicates=${duplicates} lastStatus=${status}`,
        reasons: [
          {
            code: "WEBHOOK_PATTERN",
            label: "Patrones webhook",
            triggered: true,
            points: score,
            details: { provider, errors, duplicates, status },
          },
        ],
        source: "webhook",
        context: { provider, errorsLast1h: errors, duplicatesLast1h: duplicates, lastStatus: status },
      },
    });

    this.events.enqueue([
      {
        id: `evt-fraud-webhook-${assessment.id}`,
        name: "FraudAlertRaised",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "api",
        companyId,
        subjectId: null,
        payload: {
          assessmentId: assessment.id,
          source: "webhook",
          provider,
          score,
          errors,
          duplicates,
        },
      },
    ]);

    await this.notifyAlert({
      type: "fraud_webhook_pattern",
      companyId,
      provider,
      score,
      errors,
      duplicates,
      assessmentId: assessment.id,
    });

    return assessment;
  }
}
