import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type ReconciliationAlert = {
  type: string;
  message: string;
  orderId?: string;
  paymentId?: string;
  saleId?: string;
};

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(dateStr?: string, tz?: string) {
    const date = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end, tz: tz ?? "UTC" };
  }

  async report(companyId: string, dateStr?: string, tz?: string) {
    const { start, end } = this.dateRange(dateStr, tz);

    const orders = await this.prisma.order.findMany({
      where: { companyId, createdAt: { gte: start, lt: end } },
      include: { payments: true },
    });

    const sales = await this.prisma.sale.findMany({
      where: { companyId, createdAt: { gte: start, lt: end } },
      include: { items: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: start, lt: end }, order: { companyId } },
      include: { order: true },
    });

    const alerts: ReconciliationAlert[] = [];

    const paidOrderIds = new Set(payments.map((p) => p.orderId));
    for (const order of orders) {
      if (order.status === "PAID" && !paidOrderIds.has(order.id)) {
        alerts.push({ type: "order_without_payment", message: "Order marked paid without payment", orderId: order.id });
      }
    }

    for (const payment of payments) {
      if (!payment.order) {
        alerts.push({ type: "payment_without_order", message: "Payment without order", paymentId: payment.id });
      }
    }

    const totalsByPayment: Record<string, number> = {};
    for (const payment of payments) {
      const key = payment.provider;
      totalsByPayment[key] = (totalsByPayment[key] ?? 0) + Number(payment.amount);
    }

    const salesTotalsByMethod: Record<string, number> = {};
    for (const sale of sales) {
      salesTotalsByMethod[sale.paymentMethod] = (salesTotalsByMethod[sale.paymentMethod] ?? 0) + Number(sale.total);
    }

    const totals = {
      orders: orders.reduce((sum, o) => sum + Number(o.shippingCost ?? 0), 0),
      payments: totalsByPayment,
      sales: salesTotalsByMethod,
    };

    return {
      period: { start: start.toISOString(), end: end.toISOString(), tz: tz ?? "UTC" },
      totals,
      alerts,
      counts: {
        orders: orders.length,
        payments: payments.length,
        sales: sales.length,
      },
    };
  }

  async exportCsv(companyId: string, dateStr?: string, tz?: string) {
    const report = await this.report(companyId, dateStr, tz);
    const rows = [
      { section: "totals", key: "payments", value: JSON.stringify(report.totals.payments) },
      { section: "totals", key: "sales", value: JSON.stringify(report.totals.sales) },
      { section: "counts", key: "orders", value: report.counts.orders },
      { section: "counts", key: "payments", value: report.counts.payments },
      { section: "counts", key: "sales", value: report.counts.sales },
    ];

    const headers = ["section", "key", "value"];
    const csv = [headers.join(","), ...rows.map((r) => `${r.section},${r.key},${r.value}`)].join("\n");
    return csv;
  }
}
