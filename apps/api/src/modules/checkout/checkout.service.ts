import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ShippingMode, ShippingProvider } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateOrderDto } from "./dto/checkout.dto";
import { ShippingService } from "./shipping.service";
import { StockReservationService } from "../stock-reservations/stock-reservation.service";
import { PluginsService } from "../plugins/plugins.service";
import { EventsService } from "../events/events.service";
import { PromosService } from "../promos/promos.service";
import { FraudService } from "../fraud/fraud.service";
import { DeveloperApiService } from "../developer-api/developer-api.service";
import { TaxesService } from "../taxes/taxes.service";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
    private readonly reservations: StockReservationService,
    private readonly plugins: PluginsService,
    private readonly events: EventsService,
    private readonly promos: PromosService,
    private readonly fraud: FraudService,
    private readonly developerApi: DeveloperApiService,
    private readonly taxes: TaxesService,
  ) {}

  async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return company;
  }

  async createOrder(dto: CreateOrderDto, riskContext?: { ip?: string; geoCountry?: string }) {
    const company = await this.getCompany();
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId: company.id },
      select: { currency: true },
    });

    const quote = await this.shipping.quote(company.id, {
      shippingMode: dto.shippingMode,
      shippingProvider: dto.shippingProvider,
      address: dto.address,
      items: dto.items,
      branchId: dto.branchId,
    });

    const option =
      quote.options?.find((opt) => opt.id === dto.shippingOptionId) ?? quote.options?.[0];
    const branchId = dto.branchId ?? (dto.shippingMode === "PICKUP" ? option?.id : null);

    const order = await this.prisma.$transaction(async (tx) => {
      const productIds = dto.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { variants: true, productCats: true },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      const categoryMap = new Map(products.map((p) => [p.id, p.productCats.map((c) => c.categoryId)]));

      const pricingItems = dto.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: 1000,
      }));
      const adjustedPricing = await this.plugins.applyPricingRules(company.id, pricingItems);
      const priceMap = new Map(adjustedPricing.map((item) => [`${item.productId}:${item.variantId ?? ""}`, item.unitPrice]));

      const detailedItems = dto.items.map((item) => {
        const key = `${item.productId}:${item.variantId ?? ""}`;
        const unitPrice = Number(priceMap.get(key) ?? 1000);
        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
          unitPrice,
          categoryIds: categoryMap.get(item.productId) ?? [],
        };
      });

      const subtotal = detailedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      const couponResult = dto.couponCode
        ? await this.promos.applyCoupon(
            company.id,
            {
              code: dto.couponCode,
              items: detailedItems,
              subtotal,
              shippingCost: Number(option?.price ?? 0),
              priceListId: dto.priceListId,
              customerId: dto.customerId,
              customerEmail: dto.customerEmail,
            },
            tx,
          )
        : { ok: false };

      const couponDiscount = couponResult.ok ? couponResult.discount : 0;
      const freeShipping = couponResult.ok ? couponResult.freeShipping : false;
      const shippingCostValue = freeShipping ? 0 : Number(option?.price ?? 0);

      let loyaltyDiscount = 0;
      let loyaltyPointsEarned = 0;
      if (dto.customerId) {
        const points = await this.promos.calculateLoyaltyPoints(company.id, detailedItems, subtotal, dto.customerId);
        loyaltyPointsEarned = points;
        if (dto.loyaltyPointsToUse) {
          loyaltyDiscount = dto.loyaltyPointsToUse;
        }
      }

      const discountTotal = couponDiscount + loyaltyDiscount;
      const totalBeforeGiftCard = Math.max(0, subtotal + shippingCostValue - discountTotal);
      const taxCalc = await this.taxes.calculateForCheckoutTx(tx as Prisma.TransactionClient, company.id, {
        currency: settings?.currency ?? "ARS",
        shippingCost: shippingCostValue,
        discountTotal,
        address: dto.address
          ? {
              country: dto.address.country,
              state: dto.address.state,
              city: dto.address.city,
              postalCode: dto.address.postalCode,
            }
          : undefined,
        items: detailedItems.map((item) => ({
          productId: item.productId,
          categoryIds: item.categoryIds,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      const created = await tx.order.create({
        include: { taxBreakdown: true },
        data: {
          companyId: company.id,
          branchId: branchId ?? undefined,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          shippingMode: dto.shippingMode as ShippingMode,
          shippingProvider: dto.shippingProvider ? (dto.shippingProvider as ShippingProvider) : null,
          shippingCost: new Prisma.Decimal(shippingCostValue),
          shippingLabel: option?.label ?? null,
          shippingMeta: option ?? null,
          status: "CREATED",
          subtotal: new Prisma.Decimal(subtotal),
          discountTotal: new Prisma.Decimal(discountTotal),
          couponId: couponResult.ok ? couponResult.coupon.id : null,
          couponCode: couponResult.ok ? couponResult.coupon.code : null,
          giftCardId: null,
          giftCardAmount: new Prisma.Decimal(0),
          loyaltyPointsUsed: dto.loyaltyPointsToUse ?? 0,
          loyaltyPointsEarned,
          addressLine1: dto.address?.line1 ?? null,
          addressLine2: dto.address?.line2 ?? null,
          city: dto.address?.city ?? null,
          state: dto.address?.state ?? null,
          postalCode: dto.address?.postalCode ?? null,
          country: dto.address?.country ?? null,
          items: {
            create: dto.items.map((item) => {
              const product = productMap.get(item.productId);
              const variant = item.variantId
                ? product?.variants.find((v) => v.id === item.variantId)
                : product?.variants[0];
              const key = `${item.productId}:${item.variantId ?? ""}`;
              const unitPrice = new Prisma.Decimal(priceMap.get(key) ?? 1000);
              return {
                productId: item.productId,
                variantId: item.variantId ?? variant?.id ?? null,
                name: product?.name ?? "Item",
                sku: variant?.sku ?? null,
                quantity: item.quantity,
                unitPrice,
              };
            }),
          },
          taxBreakdown: {
            create: this.taxes.buildOrderTaxBreakdownCreateInput(company.id, taxCalc),
          },
        },
      });

      if (couponResult.ok) {
        await this.promos.redeemCoupon(company.id, couponResult.coupon.id, couponDiscount, created.id, dto.customerId, dto.customerEmail, tx);
      }

      if (dto.customerId && dto.loyaltyPointsToUse) {
        await this.promos.applyLoyaltyRedeem(company.id, dto.customerId, dto.loyaltyPointsToUse, created.id, tx);
      }

      if (dto.customerId && loyaltyPointsEarned > 0) {
        await this.promos.earnLoyalty(company.id, dto.customerId, loyaltyPointsEarned, created.id, tx);
      }

      if (dto.giftCardCode && totalBeforeGiftCard > 0) {
        const giftCard = await this.promos.applyGiftCard(company.id, dto.giftCardCode, totalBeforeGiftCard, created.id, tx);
        await tx.order.update({
          where: { id: created.id },
          data: {
            giftCardId: giftCard.card.id,
            giftCardAmount: new Prisma.Decimal(giftCard.applied),
          },
        });
      }

      const ttlMinutes = Number(process.env.RESERVATION_TTL_MINUTES ?? 30);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const reservationItems = dto.items.map((item) => {
        const product = productMap.get(item.productId);
        const variant = item.variantId
          ? product?.variants.find((v) => v.id === item.variantId)
          : product?.variants[0];
        if (!variant) {
          throw new BadRequestException("Variant not found");
        }
        return { variantId: variant.id, quantity: item.quantity };
      });

      await this.reservations.reserveWithClient(
        tx as unknown,
        company.id,
        created.id,
        reservationItems,
        expiresAt,
        branchId ?? undefined,
      );

      await tx.orderStatusEvent.create({
        data: {
          orderId: created.id,
          status: "CREATED",
          message: "Order created",
        },
      });

      return created;
    });

    this.events.enqueue([
      {
        id: `evt-${order.id}`,
        name: "OrderCreated",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "api",
        companyId: company.id,
        subjectId: order.id,
        payload: {
          orderId: order.id,
          totalItems: dto.items.length,
          shippingMode: dto.shippingMode,
        },
      },
    ]);

    await this.fraud
      .assessOrder(company.id, order.id, {
        source: "checkout",
        ip: riskContext?.ip,
        geoCountry: riskContext?.geoCountry,
      })
      .catch(() => undefined);

    await this.developerApi
      .dispatchWebhookEvent(company.id, "OrderCreated", {
        orderId: order.id,
        shippingMode: order.shippingMode,
        status: order.status,
      })
      .catch(() => undefined);

    return order;
  }

  async getStatus(orderId: string) {
    const events = await this.prisma.orderStatusEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    return { orderId, events };
  }

  async getOrderWithItems(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }
}
