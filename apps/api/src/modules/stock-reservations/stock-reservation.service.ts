import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { LotsService } from "../lots/lots.service";

export type ReservationItem = {
  variantId: string;
  quantity: number;
};

@Injectable()
export class StockReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lots: LotsService,
  ) {}

  async reserveWithClient(
    client: PrismaService | Prisma.TransactionClient,
    companyId: string,
    orderId: string,
    items: ReservationItem[],
    expiresAt: Date,
    branchId?: string,
  ) {
    for (const item of items) {
      let picks = [] as Array<{ lotId: string; stockItemId: string; quantity: number; lotCode: string; expiryDate: Date | null }>;
      try {
        picks = await this.lots.allocateLotsWithClient(
          client as any,
          companyId,
          item.variantId,
          item.quantity,
          branchId,
        );
      } catch (error) {
        const hasTrackedLots = await this.lots.hasTrackedLotsWithClient(
          client as any,
          companyId,
          item.variantId,
          branchId,
        );
        if (hasTrackedLots) {
          throw error;
        }
        picks = [];
      }

      const byStockItem = new Map<string, number>();
      if (picks.length > 0) {
        for (const pick of picks) {
          byStockItem.set(pick.stockItemId, (byStockItem.get(pick.stockItemId) ?? 0) + pick.quantity);
        }
      } else {
        const stockItem = await client.stockItem.findFirst({
          where: {
            companyId,
            branchId: branchId ?? undefined,
            variantId: item.variantId,
            deletedAt: null,
          },
          orderBy: { createdAt: "asc" },
        });
        if (!stockItem) {
          throw new BadRequestException("Stock item not found");
        }
        byStockItem.set(stockItem.id, item.quantity);
      }

      for (const [stockItemId, qty] of byStockItem.entries()) {
        const updated = await client.$executeRaw`
          UPDATE "StockItem"
          SET "reservedQuantity" = "reservedQuantity" + ${qty}
          WHERE "id" = ${stockItemId}
            AND ("quantity" - "reservedQuantity") >= ${qty}
        `;
        if (Number(updated) === 0) {
          throw new BadRequestException("Insufficient stock");
        }
      }

      const reservation = await client.stockReservation.create({
        data: {
          companyId,
          branchId: branchId ?? null,
          orderId,
          variantId: item.variantId,
          quantity: item.quantity,
          status: ReservationStatus.RESERVED,
          expiresAt,
        },
      });
      if (picks.length > 0) {
        await this.lots.reserveLotsWithClient(client as any, companyId, reservation.id, picks);
      }

      if (picks[0]?.stockItemId) {
        await client.stockMovement.create({
          data: {
            companyId,
            branchId: branchId ?? null,
            stockItemId: picks[0].stockItemId,
            delta: 0,
            reason: "reserve",
          },
        });
      }
    }
  }

  async confirm(orderId: string) {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { orderId, status: ReservationStatus.RESERVED },
    });

    for (const reservation of reservations) {
      const lotRows = await this.prisma.stockReservationLot.findMany({
        where: { reservationId: reservation.id },
        include: { lot: true },
      });
      const byStockItem = new Map<string, number>();
      if (lotRows.length > 0) {
        for (const row of lotRows) {
          byStockItem.set(row.lot.stockItemId, (byStockItem.get(row.lot.stockItemId) ?? 0) + row.quantity);
        }
      } else {
        const stockItem = await this.prisma.stockItem.findFirst({
          where: {
            companyId: reservation.companyId,
            branchId: reservation.branchId ?? undefined,
            variantId: reservation.variantId,
            deletedAt: null,
          },
          orderBy: { createdAt: "asc" },
        });
        if (!stockItem) {
          throw new BadRequestException("Stock item not found");
        }
        byStockItem.set(stockItem.id, reservation.quantity);
      }

      for (const [stockItemId, qty] of byStockItem.entries()) {
        const updated = await this.prisma.$executeRaw`
          UPDATE "StockItem"
          SET "reservedQuantity" = "reservedQuantity" - ${qty},
              "quantity" = "quantity" - ${qty}
          WHERE "id" = ${stockItemId}
            AND "reservedQuantity" >= ${qty}
            AND "quantity" >= ${qty}
        `;
        if (Number(updated) === 0) {
          throw new BadRequestException("Reservation confirm failed");
        }
      }
      if (lotRows.length > 0) {
        await this.lots.confirmReservationLotsWithClient(this.prisma as any, reservation.id);
      }

      await this.prisma.stockReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONFIRMED, confirmedAt: new Date() },
      });

      if (lotRows[0]?.lot.stockItemId) {
        await this.prisma.stockMovement.create({
          data: {
            companyId: reservation.companyId,
            branchId: reservation.branchId ?? null,
            stockItemId: lotRows[0].lot.stockItemId,
            delta: -reservation.quantity,
            reason: "confirm",
          },
        });
      }
    }
  }

  async release(orderId: string, reason: "cancel" | "expire") {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { orderId, status: ReservationStatus.RESERVED },
    });

    for (const reservation of reservations) {
      const lotRows = await this.prisma.stockReservationLot.findMany({
        where: { reservationId: reservation.id },
        include: { lot: true },
      });
      const byStockItem = new Map<string, number>();
      if (lotRows.length > 0) {
        for (const row of lotRows) {
          byStockItem.set(row.lot.stockItemId, (byStockItem.get(row.lot.stockItemId) ?? 0) + row.quantity);
        }
      } else {
        const stockItem = await this.prisma.stockItem.findFirst({
          where: {
            companyId: reservation.companyId,
            branchId: reservation.branchId ?? undefined,
            variantId: reservation.variantId,
            deletedAt: null,
          },
          orderBy: { createdAt: "asc" },
        });
        if (!stockItem) {
          throw new BadRequestException("Stock item not found");
        }
        byStockItem.set(stockItem.id, reservation.quantity);
      }
      for (const [stockItemId, qty] of byStockItem.entries()) {
        await this.prisma.$executeRaw`
          UPDATE "StockItem"
          SET "reservedQuantity" = GREATEST("reservedQuantity" - ${qty}, 0)
          WHERE "id" = ${stockItemId}
        `;
      }
      if (lotRows.length > 0) {
        await this.lots.releaseReservationLotsWithClient(this.prisma as any, reservation.id);
      }

      await this.prisma.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: reason === "cancel" ? ReservationStatus.CANCELED : ReservationStatus.EXPIRED,
          canceledAt: new Date(),
        },
      });

      if (lotRows[0]?.lot.stockItemId) {
        await this.prisma.stockMovement.create({
          data: {
            companyId: reservation.companyId,
            branchId: reservation.branchId ?? null,
            stockItemId: lotRows[0].lot.stockItemId,
            delta: 0,
            reason: reason === "cancel" ? "release" : "expire",
          },
        });
      }
    }
  }
}
