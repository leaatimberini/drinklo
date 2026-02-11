import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

export type ReservationItem = {
  variantId: string;
  quantity: number;
};

@Injectable()
export class StockReservationService {
  constructor(private readonly prisma: PrismaService) {}

  async reserveWithClient(
    client: PrismaService | Prisma.TransactionClient,
    companyId: string,
    orderId: string,
    items: ReservationItem[],
    expiresAt: Date,
    branchId?: string,
  ) {
    for (const item of items) {
      const stockItem = await client.stockItem.findFirst({
        where: { companyId, branchId: branchId ?? undefined, variantId: item.variantId, deletedAt: null },
        orderBy: { quantity: "desc" },
      });

      if (!stockItem) {
        throw new BadRequestException("Stock item not found");
      }

      const updated = await client.$executeRaw`
        UPDATE "StockItem"
        SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}
        WHERE "id" = ${stockItem.id}
          AND ("quantity" - "reservedQuantity") >= ${item.quantity}
      `;

      if (Number(updated) === 0) {
        throw new BadRequestException("Insufficient stock");
      }

      await client.stockReservation.create({
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

      await client.stockMovement.create({
        data: {
          companyId,
          branchId: branchId ?? null,
          stockItemId: stockItem.id,
          delta: 0,
          reason: "reserve",
        },
      });
    }
  }

  async confirm(orderId: string) {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { orderId, status: ReservationStatus.RESERVED },
    });

    for (const reservation of reservations) {
      const stockItem = await this.prisma.stockItem.findFirst({
        where: {
          companyId: reservation.companyId,
          branchId: reservation.branchId ?? undefined,
          variantId: reservation.variantId,
          deletedAt: null,
        },
      });
      if (!stockItem) {
        throw new BadRequestException("Stock item not found");
      }

      const updated = await this.prisma.$executeRaw`
        UPDATE "StockItem"
        SET "reservedQuantity" = "reservedQuantity" - ${reservation.quantity},
            "quantity" = "quantity" - ${reservation.quantity}
        WHERE "id" = ${stockItem.id}
          AND "reservedQuantity" >= ${reservation.quantity}
          AND "quantity" >= ${reservation.quantity}
      `;

      if (Number(updated) === 0) {
        throw new BadRequestException("Reservation confirm failed");
      }

      await this.prisma.stockReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONFIRMED, confirmedAt: new Date() },
      });

      await this.prisma.stockMovement.create({
        data: {
          companyId: reservation.companyId,
          branchId: reservation.branchId ?? null,
          stockItemId: stockItem.id,
          delta: -reservation.quantity,
          reason: "confirm",
        },
      });
    }
  }

  async release(orderId: string, reason: "cancel" | "expire") {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { orderId, status: ReservationStatus.RESERVED },
    });

    for (const reservation of reservations) {
      const stockItem = await this.prisma.stockItem.findFirst({
        where: {
          companyId: reservation.companyId,
          branchId: reservation.branchId ?? undefined,
          variantId: reservation.variantId,
          deletedAt: null,
        },
      });
      if (!stockItem) {
        continue;
      }

      await this.prisma.$executeRaw`
        UPDATE "StockItem"
        SET "reservedQuantity" = GREATEST("reservedQuantity" - ${reservation.quantity}, 0)
        WHERE "id" = ${stockItem.id}
      `;

      await this.prisma.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: reason === "cancel" ? ReservationStatus.CANCELED : ReservationStatus.EXPIRED,
          canceledAt: new Date(),
        },
      });

      await this.prisma.stockMovement.create({
        data: {
          companyId: reservation.companyId,
          branchId: reservation.branchId ?? null,
          stockItemId: stockItem.id,
          delta: 0,
          reason: reason === "cancel" ? "release" : "expire",
        },
      });
    }
  }
}
