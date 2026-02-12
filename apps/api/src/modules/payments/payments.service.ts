import { Injectable } from "@nestjs/common";
import { Prisma, PaymentProvider, PaymentStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { MercadoPagoAdapter } from "./adapters/mercadopago.adapter";
import { StockReservationService } from "../stock-reservations/stock-reservation.service";
import { SecretsService } from "../secrets/secrets.service";
import { DeveloperApiService } from "../developer-api/developer-api.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StockReservationService,
    private readonly secrets: SecretsService,
    private readonly developerApi: DeveloperApiService,
  ) {}

  private async adapter(companyId: string) {
    const secret = await this.secrets.getSecret(companyId, "MERCADOPAGO");
    const accessToken = secret?.accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN is required");
    }
    return new MercadoPagoAdapter({ accessToken });
  }

  async getPayment(paymentId: string) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new Error("Company not found");
    }
    const adapter = await this.adapter(company.id);
    return adapter.getPayment(paymentId);
  }

  async createPreference(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new Error("Order not found");
    }

    const existing = await this.prisma.payment.findFirst({
      where: { orderId, provider: "MERCADOPAGO" },
    });

    if (existing?.preferenceId && (existing.raw as any)?.init_point) {
      const initPoint =
        process.env.PAYMENT_SANDBOX === "true"
          ? (existing.raw as any)?.sandbox_init_point ?? (existing.raw as any).init_point
          : (existing.raw as any).init_point;
      return { preferenceId: existing.preferenceId, initPoint };
    }

    const settings = await this.prisma.companySettings.findFirst({
      where: { companyId: order.companyId },
    });
    const currency = settings?.currency ?? "ARS";

    const adapter = await this.adapter(order.companyId);
    const preference = await adapter.createPreference({
      items: order.items.map((item) => ({
        title: item.name,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        currency_id: currency,
      })),
      external_reference: order.id,
      back_urls: {
        success: process.env.MERCADOPAGO_SUCCESS_URL,
        failure: process.env.MERCADOPAGO_FAILURE_URL,
        pending: process.env.MERCADOPAGO_PENDING_URL,
      },
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL,
    });

    if (existing) {
      await this.prisma.payment.update({
        where: { id: existing.id },
        data: { preferenceId: preference.id, raw: preference as any },
      });
    } else {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.MERCADOPAGO,
          preferenceId: preference.id,
          status: PaymentStatus.PENDING,
          amount: new Prisma.Decimal(
            preference.items?.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0) ?? 0,
          ),
          currency,
          raw: preference as any,
        },
      });
    }

    const initPoint =
      process.env.PAYMENT_SANDBOX === "true"
        ? (preference as any).sandbox_init_point ?? preference.init_point
        : preference.init_point;
    return { preferenceId: preference.id, initPoint };
  }

  async updatePaymentStatus(orderId: string, status: PaymentStatus, raw: any, paymentId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { companyId: true },
    });
    if (!order) {
      throw new Error("Order not found");
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId, provider: PaymentProvider.MERCADOPAGO },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          paymentId: paymentId ?? payment.paymentId,
          raw,
        },
      });
    }

    const orderStatus =
      status === PaymentStatus.APPROVED
        ? "PAID"
        : status === PaymentStatus.REJECTED || status === PaymentStatus.CANCELED
          ? "CANCELED"
          : "CREATED";

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatus },
    });

    await this.prisma.orderStatusEvent.create({
      data: {
        orderId,
        status: orderStatus,
        message: `Payment status ${status}`,
      },
    });

    if (status === PaymentStatus.APPROVED) {
      await this.reservations.confirm(orderId);
      await this.developerApi
        .dispatchWebhookEvent(order.companyId, "PaymentApproved", {
          orderId,
          paymentId: paymentId ?? payment?.paymentId ?? null,
          status,
        })
        .catch(() => undefined);
    }
    if (status === PaymentStatus.REJECTED || status === PaymentStatus.CANCELED) {
      await this.reservations.release(orderId, "cancel");
    }
  }
}
