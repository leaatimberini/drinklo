import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateStockItemDto, CreateStockLocationDto, UpdateStockItemDto } from "./dto/stock.dto";

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  listLocations(companyId: string) {
    return this.prisma.stockLocation.findMany({ where: { companyId, deletedAt: null } });
  }

  async createLocation(companyId: string, dto: CreateStockLocationDto, createdById?: string) {
    const branchId =
      dto.branchId ??
      (await this.prisma.branch.findFirst({ where: { companyId } }))?.id ??
      undefined;
    return this.prisma.stockLocation.create({
      data: { companyId, branchId, name: dto.name, createdById, updatedById: createdById },
    });
  }

  listItems(companyId: string) {
    return this.prisma.stockItem.findMany({
      where: { companyId, deletedAt: null },
      include: { variant: true, location: true },
    });
  }

  async updateItem(
    companyId: string,
    id: string,
    dto: UpdateStockItemDto,
    updatedById?: string,
  ) {
    const existing = await this.prisma.stockItem.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Stock item not found");
    }

    const delta = dto.quantity - existing.quantity;
    const item = await this.prisma.stockItem.update({
      where: { id },
      data: { quantity: dto.quantity, updatedById },
    });

    if (delta !== 0) {
      await this.prisma.stockMovement.create({
        data: {
          companyId,
          branchId: existing.branchId ?? null,
          stockItemId: id,
          delta,
          reason: "manual_adjustment",
        },
      });
    }

    return item;
  }

  async createItem(companyId: string, dto: CreateStockItemDto, createdById?: string) {
    const location = await this.prisma.stockLocation.findFirst({
      where: { id: dto.locationId, companyId, deletedAt: null },
    });
    const branchId = dto.branchId ?? location?.branchId ?? null;
    const item = await this.prisma.stockItem.create({
      data: {
        companyId,
        branchId,
        variantId: dto.variantId,
        locationId: dto.locationId,
        quantity: dto.quantity,
        createdById,
        updatedById: createdById,
      },
    });

    await this.prisma.stockMovement.create({
      data: {
        companyId,
        branchId,
        stockItemId: item.id,
        delta: dto.quantity,
        reason: "initial",
      },
    });

    return item;
  }
}
