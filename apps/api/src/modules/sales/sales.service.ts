import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SaleStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSaleDto, OfflineSaleDraftDto } from "./dto/sales.dto";

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return company;
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
    index: ReturnType<SalesService["buildRuleIndex"]>,
    productId: string,
    variantId: string | null | undefined,
    quantity: number,
  ) {
    if (variantId) {
      const rules = index.variantRules.get(variantId) ?? [];
      const rule = rules.find((candidate) => candidate.minQty <= quantity);
      if (rule) {
        return rule.price;
      }
    }
    const productRules = index.productRules.get(productId) ?? [];
    const productRule = productRules.find((candidate) => candidate.minQty <= quantity);
    if (productRule) {
      return productRule.price;
    }
    return null;
  }

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

  private async getStockMap(companyId: string, variantIds?: string[]) {
    const stock = await this.prisma.stockItem.groupBy({
      by: ["variantId"],
      where: {
        companyId,
        deletedAt: null,
        ...(variantIds && variantIds.length > 0 ? { variantId: { in: variantIds } } : {}),
      },
      _sum: { quantity: true },
    });

    return new Map(stock.map((row) => [row.variantId, row._sum.quantity ?? 0]));
  }

  private async findSaleByClientTxn(companyId: string, clientTxnId?: string) {
    if (!clientTxnId) return null;
    return this.prisma.sale.findUnique({
      where: { companyId_clientTxnId: { companyId, clientTxnId } },
      include: { items: true },
    });
  }

  async searchProducts(q?: string) {
    const company = await this.getCompany();
    const term = q?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
                { variants: { some: { barcode: { contains: term, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: { variants: { where: { deletedAt: null } } },
      take: 20,
    });

    const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));
    const priceListId = await this.getDefaultPriceListId(company.id);
    const priceRules = await this.prisma.priceRule.findMany({
      where: {
        companyId: company.id,
        priceListId,
        deletedAt: null,
        OR: [
          { variantId: { in: variantIds } },
          { productId: { in: products.map((product) => product.id) } },
        ],
      },
      select: { variantId: true, productId: true, minQty: true, price: true },
    });
    const priceIndex = this.buildRuleIndex(priceRules);
    const stockMap = await this.getStockMap(company.id, variantIds);

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        price:
          this.resolveUnitPrice(priceIndex, product.id, variant.id, 1)?.toNumber() ??
          0,
        stock: stockMap.get(variant.id) ?? 0,
      })),
    }));
  }

  async createSale(dto: CreateSaleDto) {
    const company = await this.getCompany();
    const existing = await this.findSaleByClientTxn(company.id, dto.clientTxnId);
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const productIds = dto.items.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, companyId: company.id, deletedAt: null },
          include: { variants: { where: { deletedAt: null } } },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        const priceListId = await this.getDefaultPriceListId(company.id);
        const variantIdsForPricing = dto.items
          .map((item) => item.variantId ?? productMap.get(item.productId)?.variants[0]?.id)
          .filter(Boolean) as string[];
        const priceRules = await tx.priceRule.findMany({
          where: {
            companyId: company.id,
            priceListId,
            deletedAt: null,
            OR: [
              { variantId: { in: variantIdsForPricing } },
              { productId: { in: productIds } },
            ],
          },
          select: { variantId: true, productId: true, minQty: true, price: true },
        });
        const priceIndex = this.buildRuleIndex(priceRules);

        const saleItems = dto.items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new NotFoundException("Product not found");
          }
          const variant = item.variantId
            ? product.variants.find((v) => v.id === item.variantId)
            : product.variants[0];
          if (!variant) {
            throw new BadRequestException("Variant not found");
          }
          const unitPrice = this.resolveUnitPrice(priceIndex, product.id, variant.id, item.quantity);
          if (!unitPrice) {
            throw new BadRequestException("Price rule not found");
          }
          const total = unitPrice.mul(item.quantity);
          return {
            product,
            variant,
            quantity: item.quantity,
            unitPrice,
            total,
          };
        });

        const subtotal = saleItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
        const discount = new Prisma.Decimal(dto.discount ?? 0);
        const total = subtotal.sub(discount);
        const paidAmount = new Prisma.Decimal(dto.paidAmount ?? total.toNumber());
        const changeAmount = paidAmount.sub(total);

        for (const item of saleItems) {
          const stockItem = await tx.stockItem.findFirst({
            where: { companyId: company.id, variantId: item.variant.id, deletedAt: null },
          });
          if (!stockItem) {
            throw new BadRequestException("Stock item not found");
          }
          if (stockItem.quantity < item.quantity) {
            throw new BadRequestException("Insufficient stock");
          }

          await tx.stockMovement.create({
            data: {
              companyId: company.id,
              stockItemId: stockItem.id,
              delta: -item.quantity,
              reason: "reserve",
            },
          });

          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: stockItem.quantity - item.quantity },
          });

          await tx.stockMovement.create({
            data: {
              companyId: company.id,
              stockItemId: stockItem.id,
              delta: 0,
              reason: "sale",
            },
          });
        }

        const sale = await tx.sale.create({
          data: {
            companyId: company.id,
            clientTxnId: dto.clientTxnId,
            subtotal,
            discount,
            total,
            currency: "ARS",
            paymentMethod: dto.paymentMethod,
            paidAmount,
            changeAmount,
            status: SaleStatus.PAID,
            items: {
              create: saleItems.map((item) => ({
                productId: item.product.id,
                variantId: item.variant.id,
                name: item.product.name,
                sku: item.variant.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              })),
            },
          },
          include: { items: true },
        });

        return sale;
      });
    } catch (error) {
      if (dto.clientTxnId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existingSale = await this.findSaleByClientTxn(company.id, dto.clientTxnId);
        if (existingSale) {
          return existingSale;
        }
      }
      throw error;
    }
  }

  async getOfflineCatalog(updatedSince?: string) {
    const company = await this.getCompany();
    const products = await this.prisma.product.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });

    const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));
    const priceListId = await this.getDefaultPriceListId(company.id);
    const priceRules = await this.prisma.priceRule.findMany({
      where: {
        companyId: company.id,
        priceListId,
        deletedAt: null,
        OR: [
          { variantId: { in: variantIds } },
          { productId: { in: products.map((product) => product.id) } },
        ],
      },
      select: { variantId: true, productId: true, minQty: true, price: true },
    });
    const priceIndex = this.buildRuleIndex(priceRules);
    const stockMap = await this.getStockMap(company.id, variantIds);

    const items = products.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        sku: variant.sku,
        barcode: variant.barcode,
        price:
          this.resolveUnitPrice(priceIndex, product.id, variant.id, 1)?.toNumber() ??
          0,
        stock: stockMap.get(variant.id) ?? 0,
        updatedAt: variant.updatedAt.toISOString(),
      })),
    );

    return {
      items,
      generatedAt: new Date().toISOString(),
      updatedSince: updatedSince ?? null,
    };
  }

  async syncOfflineSales(drafts: OfflineSaleDraftDto[]) {
    const company = await this.getCompany();
    const created: Array<{ clientTxnId: string; saleId: string; status: "created" | "existing" }> = [];
    const failed: Array<{ clientTxnId: string; error: string }> = [];

    for (const draft of drafts) {
      const existing = await this.findSaleByClientTxn(company.id, draft.clientTxnId);
      if (existing) {
        created.push({ clientTxnId: draft.clientTxnId, saleId: existing.id, status: "existing" });
        continue;
      }

      try {
        const sale = await this.createSale(draft);
        created.push({ clientTxnId: draft.clientTxnId, saleId: sale.id, status: "created" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        failed.push({ clientTxnId: draft.clientTxnId, error: message });
      }
    }

    return { created, failed };
  }
}
