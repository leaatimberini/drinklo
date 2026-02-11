import { Cron } from "@nestjs/schedule";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

const BCRA_BASE = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0";

type BcraQuote = {
  fecha: string;
  detalle: Array<{
    codigoMoneda: string;
    tipoCotizacion: number;
  }>;
};

type BcraResponse = {
  status: number;
  results: BcraQuote;
};

@Injectable()
export class FxService {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refreshDaily();
  }

  private async fetchFromBcra(date: string): Promise<BcraQuote | null> {
    const res = await fetch(`${BCRA_BASE}/Cotizaciones?fecha=${date}`);
    if (!res.ok) return null;
    const data = (await res.json()) as BcraResponse;
    return data?.results ?? null;
  }

  private async fetchFromFallback(date: string): Promise<BcraQuote | null> {
    const url = process.env.FX_FALLBACK_URL;
    const token = process.env.FX_FALLBACK_TOKEN;
    if (!url) return null;
    const res = await fetch(`${url}?fecha=${date}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BcraResponse | BcraQuote;
    return (data as BcraResponse)?.results ?? (data as BcraQuote);
  }

  private async upsertRates(date: string, data: BcraQuote, source: string) {
    const day = new Date(`${date}T00:00:00-03:00`);
    await this.prisma.$transaction(
      data.detalle.map((row) =>
        this.prisma.fxRate.upsert({
          where: { currencyCode_date: { currencyCode: row.codigoMoneda, date: day } },
          update: { rate: new Prisma.Decimal(row.tipoCotizacion), source },
          create: {
            currencyCode: row.codigoMoneda,
            date: day,
            rate: new Prisma.Decimal(row.tipoCotizacion),
            source,
          },
        }),
      ),
    );
  }

  async refreshDaily() {
    const today = new Date();
    const date = today.toISOString().slice(0, 10);

    let data = await this.fetchFromBcra(date);
    if (data) {
      await this.upsertRates(date, data, "BCRA");
      return;
    }

    const fallback = await this.fetchFromFallback(date);
    if (fallback) {
      await this.upsertRates(date, fallback, "FALLBACK");
    }
  }

  @Cron("0 6 * * *", { timeZone: "America/Argentina/Buenos_Aires" })
  async cronDaily() {
    await this.refreshDaily();
  }

  async latest(codes: string[]) {
    const rows = await this.prisma.$queryRaw<
      Array<{ currencyCode: string; rate: number; date: Date; source: string }>
    >`
      SELECT DISTINCT ON ("currencyCode") "currencyCode", "rate", "date", "source"
      FROM "FxRate"
      WHERE "currencyCode" IN (${Prisma.join(codes)})
      ORDER BY "currencyCode", "date" DESC
    `;

    return rows;
  }

  async range(code: string, from?: string, to?: string) {
    const where: any = { currencyCode: code };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    return this.prisma.fxRate.findMany({
      where,
      orderBy: { date: "asc" },
    });
  }
}
