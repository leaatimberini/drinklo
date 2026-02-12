import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

export type LotAllocation = {
  lotId: string;
  stockItemId: string;
  quantity: number;
  lotCode: string;
  expiryDate: Date | null;
};

@Injectable()
export class LotsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasTrackedLotsWithClient(
    client: PrismaService | Prisma.TransactionClient,
    companyId: string,
    variantId: string,
    branchId?: string,
  ) {
    const count = await client.batchLot.count({
      where: {
        companyId,
        variantId,
        branchId: branchId ?? undefined,
      },
    });
    return count > 0;
  }

  async getConfig(companyId: string) {
    const settings = await this.prisma.companySettings.findFirst({
      where: { companyId },
      select: { pickingStrategy: true, blockExpiredLotSale: true },
    });
    return {
      pickingStrategy: (settings?.pickingStrategy ?? "FEFO") as "FEFO" | "FIFO",
      blockExpiredLotSale: Boolean(settings?.blockExpiredLotSale),
    };
  }

  async updateConfig(companyId: string, pickingStrategy: "FEFO" | "FIFO", blockExpiredLotSale: boolean) {
    return this.prisma.companySettings.update({
      where: { companyId },
      data: { pickingStrategy, blockExpiredLotSale },
      select: { pickingStrategy: true, blockExpiredLotSale: true },
    });
  }

  async allocateLotsWithClient(
    client: PrismaService | Prisma.TransactionClient,
    companyId: string,
    variantId: string,
    quantity: number,
    branchId?: string,
  ): Promise<LotAllocation[]> {
    if (quantity <= 0) return [];
    const settings = await client.companySettings.findFirst({
      where: { companyId },
      select: { pickingStrategy: true, blockExpiredLotSale: true },
    });
    const strategy = (settings?.pickingStrategy ?? "FEFO").toUpperCase();
    const blockExpired = Boolean(settings?.blockExpiredLotSale);
    const now = new Date();

    const lots = await client.batchLot.findMany({
      where: {
        companyId,
        branchId: branchId ?? undefined,
        variantId,
        quantity: { gt: 0 },
      },
      orderBy:
        strategy === "FIFO"
          ? [{ createdAt: "asc" }]
          : [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });

    let remaining = quantity;
    const picks: LotAllocation[] = [];

    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = Math.max(0, lot.quantity - lot.reservedQuantity);
      if (available <= 0) continue;
      if (blockExpired && lot.expiryDate && lot.expiryDate.getTime() < now.getTime()) {
        continue;
      }
      const pick = Math.min(available, remaining);
      picks.push({
        lotId: lot.id,
        stockItemId: lot.stockItemId,
        quantity: pick,
        lotCode: lot.lotCode,
        expiryDate: lot.expiryDate,
      });
      remaining -= pick;
    }

    if (remaining > 0) {
      throw new BadRequestException("Insufficient lot stock for requested quantity");
    }

    return picks;
  }

  async reserveLotsWithClient(
    client: PrismaService | Prisma.TransactionClient,
    companyId: string,
    reservationId: string,
    picks: LotAllocation[],
  ) {
    for (const pick of picks) {
      const updated = await client.$executeRaw`
        UPDATE "BatchLot"
        SET "reservedQuantity" = "reservedQuantity" + ${pick.quantity}
        WHERE "id" = ${pick.lotId}
          AND ("quantity" - "reservedQuantity") >= ${pick.quantity}
      `;
      if (Number(updated) === 0) {
        throw new BadRequestException("Lot reservation failed");
      }
      await client.stockReservationLot.create({
        data: {
          companyId,
          reservationId,
          lotId: pick.lotId,
          quantity: pick.quantity,
        },
      });
    }
  }

  async confirmReservationLotsWithClient(client: PrismaService | Prisma.TransactionClient, reservationId: string) {
    const rows = await client.stockReservationLot.findMany({ where: { reservationId } });
    for (const row of rows) {
      const updated = await client.$executeRaw`
        UPDATE "BatchLot"
        SET "reservedQuantity" = "reservedQuantity" - ${row.quantity},
            "quantity" = "quantity" - ${row.quantity}
        WHERE "id" = ${row.lotId}
          AND "reservedQuantity" >= ${row.quantity}
          AND "quantity" >= ${row.quantity}
      `;
      if (Number(updated) === 0) {
        throw new BadRequestException("Lot confirm failed");
      }
    }
  }

  async releaseReservationLotsWithClient(client: PrismaService | Prisma.TransactionClient, reservationId: string) {
    const rows = await client.stockReservationLot.findMany({ where: { reservationId } });
    for (const row of rows) {
      await client.$executeRaw`
        UPDATE "BatchLot"
        SET "reservedQuantity" = GREATEST("reservedQuantity" - ${row.quantity}, 0)
        WHERE "id" = ${row.lotId}
      `;
    }
  }

  async consumeLotsForSaleWithClient(
    client: PrismaService | Prisma.TransactionClient,
    companyId: string,
    variantId: string,
    quantity: number,
    branchId?: string,
  ) {
    const picks = await this.allocateLotsWithClient(client, companyId, variantId, quantity, branchId);
    for (const pick of picks) {
      const updated = await client.$executeRaw`
        UPDATE "BatchLot"
        SET "quantity" = "quantity" - ${pick.quantity}
        WHERE "id" = ${pick.lotId}
          AND "quantity" >= ${pick.quantity}
      `;
      if (Number(updated) === 0) {
        throw new BadRequestException("Lot consume failed");
      }
    }
    return picks;
  }

  async expiryAlerts(companyId: string, days = 30) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const lots = await this.prisma.batchLot.findMany({
      where: {
        companyId,
        quantity: { gt: 0 },
        expiryDate: { lte: until },
      },
      include: {
        variant: { select: { id: true, name: true, sku: true, product: { select: { id: true, name: true } } } },
      },
      orderBy: [{ expiryDate: "asc" }],
    });

    return lots.map((lot) => ({
      lotId: lot.id,
      lotCode: lot.lotCode,
      productId: lot.variant.product.id,
      expiryDate: lot.expiryDate,
      daysToExpiry: lot.expiryDate ? Math.ceil((lot.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null,
      quantity: lot.quantity,
      product: lot.variant.product.name,
      variant: lot.variant.name,
      sku: lot.variant.sku,
      status: lot.expiryDate && lot.expiryDate < now ? "EXPIRED" : "NEAR_EXPIRY",
    }));
  }

  async expiryAlertsWindows(companyId: string) {
    const [d30, d60, d90] = await Promise.all([
      this.expiryAlerts(companyId, 30),
      this.expiryAlerts(companyId, 60),
      this.expiryAlerts(companyId, 90),
    ]);
    return { d30, d60, d90 };
  }

  async rotationSuggestions(companyId: string, limit = 20) {
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const lots = await this.prisma.batchLot.findMany({
      where: {
        companyId,
        quantity: { gt: 0 },
        expiryDate: { lte: in60, gte: now },
      },
      include: { variant: { select: { name: true, sku: true, product: { select: { id: true, name: true } } } } },
      orderBy: [{ expiryDate: "asc" }, { quantity: "desc" }],
      take: Math.min(200, limit),
    });

    return lots.map((lot) => ({
      lotId: lot.id,
      lotCode: lot.lotCode,
      productId: lot.variant.product.id,
      expiryDate: lot.expiryDate,
      quantity: lot.quantity,
      sku: lot.variant.sku,
      product: lot.variant.product.name,
      suggestion: "Priorizar promo/rotación en picker FEFO",
    }));
  }

  async productNearExpiry(companyId: string, productId: string) {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const lots = await this.prisma.batchLot.findMany({
      where: {
        companyId,
        quantity: { gt: 0 },
        variant: { productId },
        expiryDate: { not: null, lte: in90 },
      },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      take: 10,
    });

    const nextLot = lots[0] ?? null;
    return {
      productId,
      hasNearExpiry: lots.length > 0,
      nextExpiryDate: nextLot?.expiryDate ?? null,
      nextLotCode: nextLot?.lotCode ?? null,
      totalNearExpiryQty: lots.reduce((acc, lot) => acc + lot.quantity, 0),
      lots: lots.map((lot) => ({
        lotId: lot.id,
        lotCode: lot.lotCode,
        variantId: lot.variant.id,
        variant: lot.variant.name,
        sku: lot.variant.sku,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
      })),
    };
  }
}
