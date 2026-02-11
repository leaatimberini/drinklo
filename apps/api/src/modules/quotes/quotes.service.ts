import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, QuoteStatus, SaleStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateQuoteDto, UpdateQuoteDto } from "./dto/quotes.dto";
import { SalesService } from "../sales/sales.service";

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
  ) {}

  async list() {
    return this.prisma.quote.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
  }

  async get(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, include: { items: true } });
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    return quote;
  }

  async create(dto: CreateQuoteDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const productIds = dto.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { variants: true },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      const quoteItems = dto.items.map((item) => {
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
        const unitPrice = new Prisma.Decimal(1000);
        const total = unitPrice.mul(item.quantity);
        return {
          product,
          variant,
          quantity: item.quantity,
          unitPrice,
          total,
        };
      });

      const subtotal = quoteItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
      const discount = new Prisma.Decimal(dto.discount ?? 0);
      const total = subtotal.sub(discount);

      const quote = await tx.quote.create({
        data: {
          companyId: company.id,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          subtotal,
          discount,
          total,
          currency: "ARS",
          status: QuoteStatus.OPEN,
          items: {
            create: quoteItems.map((item) => ({
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

      return quote;
    });
  }

  async update(id: string, dto: UpdateQuoteDto) {
    await this.get(id);
    return this.prisma.quote.update({
      where: { id },
      data: {
        customerName: dto.customerName ?? undefined,
        customerEmail: dto.customerEmail ?? undefined,
        discount: dto.discount !== undefined ? new Prisma.Decimal(dto.discount) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    return this.prisma.quote.delete({ where: { id } });
  }

  async convertToSale(id: string) {
    const quote = await this.get(id);
    if (quote.status === QuoteStatus.CANCELED) {
      throw new BadRequestException("Quote canceled");
    }

    const sale = await this.sales.createSale({
      items: quote.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
      })),
      discount: Number(quote.discount),
      paymentMethod: "cash",
      paidAmount: Number(quote.total),
    });

    await this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.ACCEPTED },
    });

    return { quoteId: id, saleId: sale.id, status: SaleStatus.PAID };
  }
}
