import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@erp/db";

type WarehouseOrderRow = {
  company_id: string;
  order_id: string;
  customer_email: string;
  created_at: string;
  status: string;
  item_total: number;
  shipping_cost: number;
  order_total: number;
  currency: string;
};

const DEFAULT_STATUS = ["PAID", "DELIVERED"];

export function mapOrdersToWarehouse(orders: Array<{ id: string; companyId: string; customerEmail: string; status: string; createdAt: Date; shippingCost: Prisma.Decimal; items: Array<{ quantity: number; unitPrice: Prisma.Decimal }> }>) {
  return orders.map((order) => {
    const itemTotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
    const shippingCost = Number(order.shippingCost ?? 0);
    const total = itemTotal + shippingCost;
    return {
      company_id: order.companyId,
      order_id: order.id,
      customer_email: order.customerEmail,
      created_at: order.createdAt.toISOString(),
      status: order.status,
      item_total: Number(itemTotal.toFixed(2)),
      shipping_cost: Number(shippingCost.toFixed(2)),
      order_total: Number(total.toFixed(2)),
      currency: "ARS",
    } satisfies WarehouseOrderRow;
  });
}

@Injectable()
export class WarehouseService {
  private readonly provider = (process.env.WAREHOUSE_PROVIDER ?? "clickhouse").toLowerCase();
  private readonly clickhouseUrl = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
  private readonly clickhouseDb = process.env.CLICKHOUSE_DB ?? "erp_warehouse";
  private readonly clickhouseUser = process.env.CLICKHOUSE_USER ?? "erp";
  private readonly clickhousePassword = process.env.CLICKHOUSE_PASSWORD ?? "erp";

  constructor(private readonly prisma: PrismaService) {}

  private async chExecute(query: string, body?: string) {
    const url = new URL(this.clickhouseUrl);
    url.searchParams.set("query", query);
    if (this.clickhouseUser) url.searchParams.set("user", this.clickhouseUser);
    if (this.clickhousePassword) url.searchParams.set("password", this.clickhousePassword);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ClickHouse error: ${res.status} ${text}`);
    }
    return res.text();
  }

  private async ensureClickhouseSchema() {
    await this.chExecute(`CREATE DATABASE IF NOT EXISTS ${this.clickhouseDb}`);
    await this.chExecute(`
      CREATE TABLE IF NOT EXISTS ${this.clickhouseDb}.orders (
        company_id String,
        order_id String,
        customer_email String,
        created_at DateTime,
        status String,
        item_total Float64,
        shipping_cost Float64,
        order_total Float64,
        currency String
      ) ENGINE = MergeTree()
      ORDER BY (company_id, created_at, order_id)
    `);
  }

  async runEtl() {
    if (this.provider !== "clickhouse") {
      return { ok: false, message: `provider ${this.provider} not implemented` };
    }
    await this.ensureClickhouseSchema();
    const orders = await this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
    const rows = mapOrdersToWarehouse(orders);
    await this.chExecute(`TRUNCATE TABLE ${this.clickhouseDb}.orders`);
    if (rows.length > 0) {
      const payload = rows.map((row) => JSON.stringify(row)).join("\n");
      await this.chExecute(`INSERT INTO ${this.clickhouseDb}.orders FORMAT JSONEachRow`, payload);
    }
    return { ok: true, rows: rows.length };
  }

  @Cron("30 2 * * *", { timeZone: "America/Argentina/Buenos_Aires" })
  async scheduledEtl() {
    await this.runEtl().catch(() => undefined);
  }

  private toSafeDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace("T", " ").slice(0, 19);
  }

  private buildDateFilter(from?: string, to?: string) {
    const safeFrom = this.toSafeDate(from);
    const safeTo = this.toSafeDate(to);
    if (!safeFrom && !safeTo) return "";
    const clauses: string[] = [];
    if (safeFrom) clauses.push(`created_at >= toDateTime('${safeFrom}')`);
    if (safeTo) clauses.push(`created_at <= toDateTime('${safeTo}')`);
    return clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  }

  async getCohorts(companyId: string, from?: string, to?: string) {
    await this.ensureClickhouseSchema();
    const dateFilter = this.buildDateFilter(from, to);
    const sql = `
      WITH customer_orders AS (
        SELECT
          customer_email,
          toStartOfMonth(min(created_at)) AS cohort_month,
          count() AS orders
        FROM ${this.clickhouseDb}.orders
        WHERE company_id = '${companyId}'
          AND status IN ('${DEFAULT_STATUS.join("','")}')
          ${dateFilter}
        GROUP BY customer_email
      )
      SELECT
        cohort_month,
        count() AS customers,
        countIf(orders > 1) AS repeat_customers,
        round(avg(orders), 2) AS avg_orders
      FROM customer_orders
      GROUP BY cohort_month
      ORDER BY cohort_month
      FORMAT JSON
    `;
    const raw = await this.chExecute(sql);
    const data = JSON.parse(raw);
    return data.data ?? [];
  }

  async getRetention(companyId: string, from?: string, to?: string) {
    await this.ensureClickhouseSchema();
    const dateFilter = this.buildDateFilter(from, to);
    const sql = `
      WITH customer_orders AS (
        SELECT
          customer_email,
          toStartOfMonth(min(created_at)) AS cohort_month,
          max(created_at) AS last_order_at
        FROM ${this.clickhouseDb}.orders
        WHERE company_id = '${companyId}'
          AND status IN ('${DEFAULT_STATUS.join("','")}')
          ${dateFilter}
        GROUP BY customer_email
      )
      SELECT
        cohort_month,
        count() AS customers,
        countIf(dateDiff('day', last_order_at, now()) <= 30) AS active_30d,
        round(100 * active_30d / customers, 2) AS retention_30d
      FROM customer_orders
      GROUP BY cohort_month
      ORDER BY cohort_month
      FORMAT JSON
    `;
    const raw = await this.chExecute(sql);
    const data = JSON.parse(raw);
    return data.data ?? [];
  }

  async getLtv(companyId: string, from?: string, to?: string) {
    await this.ensureClickhouseSchema();
    const dateFilter = this.buildDateFilter(from, to);
    const sql = `
      WITH customer_revenue AS (
        SELECT
          customer_email,
          sum(order_total) AS revenue,
          count() AS orders
        FROM ${this.clickhouseDb}.orders
        WHERE company_id = '${companyId}'
          AND status IN ('${DEFAULT_STATUS.join("','")}')
          ${dateFilter}
        GROUP BY customer_email
      )
      SELECT
        round(avg(revenue), 2) AS avg_ltv,
        round(median(revenue), 2) AS median_ltv,
        round(sum(revenue), 2) AS total_revenue,
        count() AS customers
      FROM customer_revenue
      FORMAT JSON
    `;
    const raw = await this.chExecute(sql);
    const data = JSON.parse(raw);
    return data.data?.[0] ?? {};
  }

  async getRfm(companyId: string, from?: string, to?: string) {
    await this.ensureClickhouseSchema();
    const dateFilter = this.buildDateFilter(from, to);
    const sql = `
      SELECT
        customer_email,
        dateDiff('day', max(created_at), now()) AS recency_days,
        count() AS frequency,
        round(sum(order_total), 2) AS monetary
      FROM ${this.clickhouseDb}.orders
      WHERE company_id = '${companyId}'
        AND status IN ('${DEFAULT_STATUS.join("','")}')
        ${dateFilter}
      GROUP BY customer_email
      ORDER BY monetary DESC
      LIMIT 200
      FORMAT JSON
    `;
    const raw = await this.chExecute(sql);
    const data = JSON.parse(raw);
    const rows = data.data ?? [];
    if (rows.length === 0) return [];
    const recencies = rows.map((r: unknown) => r.recency_days).sort((a: number, b: number) => a - b);
    const frequencies = rows.map((r: unknown) => r.frequency).sort((a: number, b: number) => a - b);
    const monetaries = rows.map((r: unknown) => r.monetary).sort((a: number, b: number) => a - b);
    const pick = (arr: number[], p: number) => arr[Math.floor((arr.length - 1) * p)] ?? arr[0];
    const thresholds = {
      recency: pick(recencies, 0.5),
      frequency: pick(frequencies, 0.5),
      monetary: pick(monetaries, 0.5),
    };
    return rows.map((row: unknown) => ({
      ...row,
      segment:
        row.recency_days <= thresholds.recency && row.frequency >= thresholds.frequency && row.monetary >= thresholds.monetary
          ? "Champions"
          : row.recency_days <= thresholds.recency && row.monetary >= thresholds.monetary
          ? "High Value"
          : row.recency_days <= thresholds.recency
          ? "Recent"
          : "At Risk",
    }));
  }
}
