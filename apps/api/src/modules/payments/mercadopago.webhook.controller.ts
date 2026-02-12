import crypto from "crypto";
import { Body, Controller, Headers, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "./payments.service";
import { SecretsService } from "../secrets/secrets.service";
import { MetricsService } from "../metrics/metrics.service";
import { FraudService } from "../fraud/fraud.service";
import { redactDeep } from "../data-governance/dlp-redactor";

function verifyMercadoPagoSignature({
  secret,
  signature,
  requestId,
  dataId,
}: {
  secret: string;
  signature?: string;
  requestId?: string;
  dataId?: string;
}) {
  if (!secret || !signature || !requestId || !dataId) {
    return false;
  }

  const tsMatch = signature.match(/ts=([^,]+)/);
  const v1Match = signature.match(/v1=([^,]+)/);
  if (!tsMatch || !v1Match) {
    return false;
  }

  const ts = tsMatch[1];
  const v1 = v1Match[1];
  const normalizedId = dataId?.toLowerCase();
  const manifest = `id:${normalizedId};request-id:${requestId};ts:${ts};`;
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(computed));
}

@ApiTags("mercadopago")
@Controller("webhooks/mercadopago")
export class MercadoPagoWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly secrets: SecretsService,
    private readonly metrics: MetricsService,
    private readonly fraud: FraudService,
  ) {}

  @Post()
  async handle(
    @Body() body: any,
    @Headers("x-signature") signature?: string,
    @Headers("x-request-id") requestId?: string,
    @Query() query?: Record<string, any>,
  ) {
    const queryId = query?.["data.id"] ?? query?.id;
    const eventId = queryId ?? body?.id ?? body?.data?.id ?? body?.resource ?? crypto.randomUUID();

    try {
      await this.prisma.webhookLog.create({
        data: {
          companyId: null,
          provider: "mercadopago",
          eventId: String(eventId),
          payload: redactDeep(body),
          headers: redactDeep({ signature, requestId }),
          status: "received",
        },
      });
      this.metrics.recordWebhook("mercadopago", "received");
    } catch (error) {
      // Idempotency: if event already exists, skip processing
      await this.prisma.webhookLog
        .updateMany({
          where: { provider: "mercadopago", eventId: String(eventId) },
          data: { status: "duplicate", processedAt: new Date() },
        })
        .catch(() => undefined);
      this.metrics.recordWebhook("mercadopago", "duplicate");
      this.metrics.recordWebhookRetry("mercadopago");
      const company = await this.prisma.company.findFirst({ select: { id: true } });
      if (company) {
        await this.fraud.recordWebhookSignal(company.id, "mercadopago", "duplicate");
      }
      return { ok: true, duplicate: true };
    }

    const company = await this.prisma.company.findFirst();
    const stored = company ? await this.secrets.getSecret(company.id, "MERCADOPAGO") : null;
    const secret = stored?.webhookSecret ?? process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
    const dataId = String(queryId ?? body?.data?.id ?? body?.resource ?? eventId);
    const isValid = secret
      ? verifyMercadoPagoSignature({
          secret,
          signature,
          requestId,
          dataId,
        })
      : true;

    if (!isValid) {
      await this.prisma.webhookLog.update({
        where: { provider_eventId: { provider: "mercadopago", eventId: String(eventId) } },
        data: { status: "invalid_signature" },
      });
      this.metrics.recordWebhook("mercadopago", "invalid_signature");
      if (company) {
        await this.fraud.recordWebhookSignal(company.id, "mercadopago", "invalid_signature");
      }
      return { ok: false };
    }

    const topic = body?.type ?? body?.topic;
    if (topic !== "payment" && topic !== "payment.created") {
      await this.prisma.webhookLog.update({
        where: { provider_eventId: { provider: "mercadopago", eventId: String(eventId) } },
        data: { status: "ignored", processedAt: new Date() },
      });
      this.metrics.recordWebhook("mercadopago", "ignored");
      if (company) {
        await this.fraud.recordWebhookSignal(company.id, "mercadopago", "ignored");
      }
      return { ok: true, ignored: true };
    }

    try {
      const paymentId = queryId ?? body?.data?.id ?? body?.resource;
      const payment = await this.payments.getPayment(String(paymentId));
      const orderId = payment?.external_reference;
      if (!orderId) {
        throw new Error("No external_reference");
      }
      const statusRaw = String(payment.status ?? "pending").toUpperCase();
      const statusMap: Record<string, any> = {
        APPROVED: "APPROVED",
        IN_PROCESS: "IN_PROCESS",
        PENDING: "PENDING",
        REJECTED: "REJECTED",
        CANCELLED: "CANCELED",
        CANCELED: "CANCELED",
      };

      const status = statusMap[statusRaw] ?? "PENDING";

      await this.payments.updatePaymentStatus(orderId, status, payment, String(paymentId));

      await this.prisma.webhookLog.update({
        where: { provider_eventId: { provider: "mercadopago", eventId: String(eventId) } },
        data: { status: "processed", processedAt: new Date() },
      });
      this.metrics.recordWebhook("mercadopago", "processed");
      if (company) {
        await this.fraud.recordWebhookSignal(company.id, "mercadopago", "processed");
      }

      return { ok: true };
    } catch (error: any) {
      await this.prisma.webhookLog.update({
        where: { provider_eventId: { provider: "mercadopago", eventId: String(eventId) } },
        data: { status: "error", error: redactDeep(error?.message ?? String(error)), processedAt: new Date() },
      });
      this.metrics.recordWebhook("mercadopago", "error");
      if (company) {
        await this.fraud.recordWebhookSignal(company.id, "mercadopago", "error");
      }
      return { ok: false };
    }
  }
}
