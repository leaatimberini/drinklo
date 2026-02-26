import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { DashboardQueryDto } from "./dto/dashboard-query.dto";

function parseDate(input?: string, fallback?: Date) {
  if (!input) return fallback ?? new Date();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? (fallback ?? new Date()) : parsed;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: DashboardQueryDto) {
    const runOnReadClient = (this.prisma as unknown).withReadClient as
      | (<T>(run: (client: unknown) => Promise<T>) => Promise<T>)
      | undefined;

    const run = async (client: unknown) => {
      const now = new Date();
      const to = parseDate(query.to, now);
      const from = parseDate(query.from, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const top = query.top ?? 10;
      const lowStock = query.lowStock ?? 5;

      const company = await client.company.findFirst();
      if (!company) {
        return {
          range: { from, to },
          kpis: { sales: 0, margin: 0, avgTicket: 0, tickets: 0, expenses: 0 },
          topProducts: [],
          lowStock: [],
        };
      }

      const kpiRows = await client.$queryRaw<
        Array<{ sales: number; tickets: number }>
      >`
      SELECT COALESCE(SUM("total"),0) as sales,
             COUNT(*) as tickets
      FROM "Sale"
      WHERE "companyId" = ${company.id}
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
    `;

      const kpiRow = kpiRows[0];
      const sales = Number(kpiRow?.sales ?? 0);
      const tickets = Number(kpiRow?.tickets ?? 0);
      const avgTicket = tickets > 0 ? sales / tickets : 0;
      const margin = sales * 0.25;
      const expenses = 0;

      const topProducts = await client.$queryRaw<
        Array<{ productId: string; name: string; revenue: number; qty: number }>
      >`
      SELECT si."productId" as "productId",
             si."name" as "name",
             COALESCE(SUM(si."total"),0) as revenue,
             COALESCE(SUM(si."quantity"),0) as qty
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s."id" = si."saleId"
      WHERE s."companyId" = ${company.id}
        AND s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
      GROUP BY si."productId", si."name"
      ORDER BY revenue DESC
      LIMIT ${top}
    `;

      const lowStockRows = await client.$queryRaw<
        Array<{ variantId: string; sku: string; quantity: number }>
      >`
      SELECT v."id" as "variantId",
             v."sku" as "sku",
             COALESCE(SUM(si."quantity"),0) as quantity
      FROM "StockItem" si
      INNER JOIN "ProductVariant" v ON v."id" = si."variantId"
      WHERE si."companyId" = ${company.id}
        AND si."deletedAt" IS NULL
      GROUP BY v."id", v."sku"
      HAVING COALESCE(SUM(si."quantity"),0) <= ${lowStock}
      ORDER BY quantity ASC
      LIMIT 50
    `;

      return {
        range: { from, to },
        kpis: {
          sales,
          margin,
          avgTicket,
          tickets,
          expenses,
        },
        topProducts,
        lowStock: lowStockRows,
      };
    };

    if (runOnReadClient) {
      return runOnReadClient(run);
    }
    return run(this.prisma as unknown);
  }
}
