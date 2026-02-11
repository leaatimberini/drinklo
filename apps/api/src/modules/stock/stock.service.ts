import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateStockItemDto,
  CreateStockLocationDto,
  ReceiveStockDto,
  UpdateStockItemDto,
} from "./dto/stock.dto";

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDefaultPriceListId(companyId: string) {
    const priceList =
      (await this.prisma.priceList.findFirst({
        where: { companyId, isDefault: true, deletedAt: null },
        select: { id: true },
      })) ??
      (await this.prisma.priceList.findFirst({
        where: { companyId, deletedAt: null },
        select: { id: true },
      }));

    if (!priceList) {
      throw new BadRequestException("No price list configured");
    }
    return priceList.id;
  }

  private buildRuleIndex(
    rules: Array<{ variantId: string | null; productId: string | null; minQty: number; price: Prisma.Decimal }>,
  ) {
    const variantRules = new Map<string, Array<(typeof rules)[number]>>();
    const productRules = new Map<string, Array<(typeof rules)[number]>>();

    for (const rule of rules) {
      if (rule.variantId) {
        const list = variantRules.get(rule.variantId) ?? [];
        list.push(rule);
        variantRules.set(rule.variantId, list);
      } else if (rule.productId) {
        const list = productRules.get(rule.productId) ?? [];
        list.push(rule);
        productRules.set(rule.productId, list);
      }
    }

    for (const list of variantRules.values()) {
      list.sort((a, b) => b.minQty - a.minQty);
    }
    for (const list of productRules.values()) {
      list.sort((a, b) => b.minQty - a.minQty);
    }

    return { variantRules, productRules };
  }

  private resolveUnitPrice(
    index: ReturnType<StockService["buildRuleIndex"]>,
    productId: string,
    variantId: string,
    quantity: number,
  ) {
    const variantRules = index.variantRules.get(variantId) ?? [];
    const rule = variantRules.find((candidate) => candidate.minQty <= quantity);
    if (rule) {
      return rule.price;
    }
    const productRules = index.productRules.get(productId) ?? [];
    const productRule = productRules.find((candidate) => candidate.minQty <= quantity);
    return productRule?.price ?? null;
  }

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

  async lookupByCode(companyId: string, code: string) {
    const term = code.trim();
    if (!term) {
      throw new BadRequestException("Code is required");
    }
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ sku: term }, { barcode: term }],
      },
      include: { product: true },
    });
    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    const stock = await this.prisma.stockItem.aggregate({
      where: { companyId, variantId: variant.id, deletedAt: null },
      _sum: { quantity: true },
    });

    const priceListId = await this.getDefaultPriceListId(companyId);
    const rules = await this.prisma.priceRule.findMany({
      where: {
        companyId,
        priceListId,
        deletedAt: null,
        OR: [{ variantId: variant.id }, { productId: variant.productId }],
      },
      select: { variantId: true, productId: true, minQty: true, price: true },
    });
    const priceIndex = this.buildRuleIndex(rules);
    const price = this.resolveUnitPrice(priceIndex, variant.productId, variant.id, 1)?.toNumber() ?? 0;

    return {
      productId: variant.productId,
      variantId: variant.id,
      name: variant.product.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price,
      stock: stock._sum.quantity ?? 0,
    };
  }

  async receiveStock(companyId: string, dto: ReceiveStockDto, createdById?: string) {
    const location = await this.prisma.stockLocation.findFirst({
      where: { id: dto.locationId, companyId, deletedAt: null },
    });
    if (!location) {
      throw new NotFoundException("Location not found");
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, companyId, deletedAt: null },
    });
    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    const branchId = location.branchId ?? null;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockItem.findFirst({
        where: { companyId, variantId: dto.variantId, locationId: dto.locationId, deletedAt: null },
      });

      const item =
        existing ??
        (await tx.stockItem.create({
          data: {
            companyId,
            branchId,
            variantId: dto.variantId,
            locationId: dto.locationId,
            quantity: 0,
            createdById,
            updatedById: createdById,
          },
        }));

      const updated = await tx.stockItem.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity + dto.quantity,
          updatedById: createdById,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          branchId,
          stockItemId: item.id,
          delta: dto.quantity,
          reason: dto.reason ?? "receive",
        },
      });

      return updated;
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
