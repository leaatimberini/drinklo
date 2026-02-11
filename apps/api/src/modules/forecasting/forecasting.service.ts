import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type DailyDemand = {
  date: string;
  quantity: number;
  promo: number;
};

export type ForecastPoint = {
  date: string;
  quantity: number;
};

export type ProductForecast = {
  productId: string;
  productName: string;
  forecast: ForecastPoint[];
  reorderPoint: number;
  reorderQuantity: number;
  currentStock: number;
  avgDaily: number;
};

const LEAD_TIME_DAYS = 7;
const SAFETY_Z = 1.65;

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDesignMatrix(data: DailyDemand[]) {
  const X: number[][] = [];
  const y: number[] = [];

  data.forEach((row, idx) => {
    const date = new Date(row.date + "T00:00:00Z");
    const dow = date.getUTCDay();
    const month = date.getUTCMonth();
    const features = [1, idx, row.promo];

    // One-hot dow (6 to avoid collinearity)
    for (let i = 0; i < 6; i++) {
      features.push(dow === i ? 1 : 0);
    }
    // One-hot month (11)
    for (let i = 0; i < 11; i++) {
      features.push(month === i ? 1 : 0);
    }

    X.push(features);
    y.push(row.quantity);
  });

  return { X, y };
}

function transpose(a: number[][]) {
  return a[0].map((_, i) => a.map((row) => row[i]));
}

function matMul(a: number[][], b: number[][]) {
  const res = Array.from({ length: a.length }, () => Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      for (let j = 0; j < b[0].length; j++) {
        res[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return res;
}

function matVecMul(a: number[][], v: number[]) {
  return a.map((row) => row.reduce((sum, val, idx) => sum + val * v[idx], 0));
}

function invert(matrix: number[][]) {
  const n = matrix.length;
  const identity = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  const a = matrix.map((row, i) => [...row, ...identity[i]]);

  for (let i = 0; i < n; i++) {
    let diag = a[i][i];
    if (Math.abs(diag) < 1e-8) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[j][i]) > Math.abs(diag)) {
          const tmp = a[i];
          a[i] = a[j];
          a[j] = tmp;
          diag = a[i][i];
          break;
        }
      }
    }
    if (Math.abs(diag) < 1e-8) {
      return null;
    }
    for (let j = 0; j < 2 * n; j++) {
      a[i][j] /= diag;
    }
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = a[k][i];
      for (let j = 0; j < 2 * n; j++) {
        a[k][j] -= factor * a[i][j];
      }
    }
  }

  return a.map((row) => row.slice(n));
}

function fitRegression(data: DailyDemand[]) {
  if (data.length < 7) {
    return null;
  }
  const { X, y } = buildDesignMatrix(data);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXInv = invert(XtX);
  if (!XtXInv) return null;
  const XtY = matVecMul(Xt, y);
  const beta = matVecMul(XtXInv, XtY);
  return beta;
}

function predict(beta: number[], date: Date, idx: number, promo: number) {
  const dow = date.getUTCDay();
  const month = date.getUTCMonth();
  const features = [1, idx, promo];
  for (let i = 0; i < 6; i++) {
    features.push(dow === i ? 1 : 0);
  }
  for (let i = 0; i < 11; i++) {
    features.push(month === i ? 1 : 0);
  }
  return Math.max(0, features.reduce((sum, val, i) => sum + val * beta[i], 0));
}

function mean(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
}

function std(values: number[]) {
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / Math.max(values.length, 1);
  return Math.sqrt(variance);
}

@Injectable()
export class ForecastingService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (!company) throw new Error("Company not found");
    return company;
  }

  private async loadDemand(companyId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 180);

    const sales = await this.prisma.saleItem.findMany({
      where: {
        sale: { companyId, createdAt: { gte: since } },
      },
      include: { sale: true, product: true },
    });

    const orders = await this.prisma.orderItem.findMany({
      where: {
        order: { companyId, createdAt: { gte: since } },
      },
      include: { order: true, product: true },
    });

    const map = new Map<string, { name: string; rows: Map<string, DailyDemand> }>();

    const add = (productId: string, productName: string, date: Date, quantity: number, promo: number) => {
      const key = productId;
      const dateKey = toDateKey(date);
      if (!map.has(key)) {
        map.set(key, { name: productName, rows: new Map() });
      }
      const entry = map.get(key)!;
      const existing = entry.rows.get(dateKey) ?? { date: dateKey, quantity: 0, promo: 0 };
      existing.quantity += quantity;
      existing.promo = Math.max(existing.promo, promo);
      entry.rows.set(dateKey, existing);
    };

    sales.forEach((item) => {
      const discount = Number(item.sale.discount ?? 0);
      add(item.productId, item.product.name, item.sale.createdAt, item.quantity, discount > 0 ? 1 : 0);
    });

    orders.forEach((item) => {
      const discount = Number(item.order.discountTotal ?? 0);
      const promo = discount > 0 || item.order.couponCode ? 1 : 0;
      add(item.productId, item.product.name, item.order.createdAt, item.quantity, promo ? 1 : 0);
    });

    return map;
  }

  private async getStock(companyId: string) {
    const stock = await this.prisma.stockItem.findMany({
      where: { companyId, deletedAt: null },
      include: { variant: true },
    });
    const map = new Map<string, number>();
    for (const item of stock) {
      const productId = item.variant.productId;
      map.set(productId, (map.get(productId) ?? 0) + item.quantity);
    }
    return map;
  }

  async forecast(companyId: string, horizonDays: number) {
    const demand = await this.loadDemand(companyId);
    const stockMap = await this.getStock(companyId);

    const results: ProductForecast[] = [];
    const today = new Date();
    const horizon = Array.from({ length: horizonDays }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i + 1);
      return date;
    });

    for (const [productId, productData] of demand.entries()) {
      const rows = Array.from(productData.rows.values()).sort((a, b) => a.date.localeCompare(b.date));
      const beta = fitRegression(rows);
      const historicalQty = rows.map((r) => r.quantity);
      const avgDaily = mean(historicalQty);
      const stdDaily = std(historicalQty);

      const forecast = horizon.map((date, idx) => {
        const predicted = beta ? predict(beta, date, rows.length + idx, 0) : avgDaily;
        return { date: toDateKey(date), quantity: Math.round(predicted) };
      });

      const leadDemand = forecast.slice(0, LEAD_TIME_DAYS).reduce((sum, f) => sum + f.quantity, 0);
      const reorderPoint = Math.round(avgDaily * LEAD_TIME_DAYS + SAFETY_Z * stdDaily);
      const currentStock = stockMap.get(productId) ?? 0;
      const reorderQuantity = Math.max(0, Math.round(leadDemand + reorderPoint - currentStock));

      results.push({
        productId,
        productName: productData.name,
        forecast,
        reorderPoint,
        reorderQuantity,
        currentStock,
        avgDaily: Math.round(avgDaily * 100) / 100,
      });
    }

    return results.sort((a, b) => b.reorderQuantity - a.reorderQuantity);
  }
}
