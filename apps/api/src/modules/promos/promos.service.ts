import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CouponType, GiftCardStatus, LoyaltyRuleType } from "@erp/db";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

type PrismaTx = Prisma.TransactionClient;

type CouponItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  categoryIds?: string[];
};

type CouponInput = {
  code: string;
  items?: CouponItem[];
  subtotal?: number;
  shippingCost?: number;
  priceListId?: string;
  customerId?: string;
  customerEmail?: string;
};

@Injectable()
export class PromosService {
  constructor(private readonly prisma: PrismaService) {}

  private getPrisma(tx?: PrismaTx) {
    return tx ?? this.prisma;
  }

  async listCoupons(companyId: string) {
    return this.prisma.coupon.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  async createCoupon(companyId: string, data: any) {
    return this.prisma.coupon.create({
      data: {
        companyId,
        code: data.code,
        type: data.type,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        usageLimit: data.usageLimit ?? null,
        perCustomerLimit: data.perCustomerLimit ?? null,
        minSubtotal: data.minSubtotal != null ? new Prisma.Decimal(data.minSubtotal) : null,
        maxDiscount: data.maxDiscount != null ? new Prisma.Decimal(data.maxDiscount) : null,
        priceListId: data.priceListId ?? null,
        categoryId: data.categoryId ?? null,
        customerId: data.customerId ?? null,
      },
    });
  }

  async listGiftCards(companyId: string) {
    return this.prisma.giftCard.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  async createGiftCard(companyId: string, data: any, createdById?: string) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.giftCard.create({
        data: {
          companyId,
          code: data.code,
          initialAmount: new Prisma.Decimal(data.amount),
          balance: new Prisma.Decimal(data.amount),
          currency: data.currency,
          issuedToEmail: data.issuedToEmail ?? null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          status: GiftCardStatus.ACTIVE,
        },
      });
      await tx.giftCardTransaction.create({
        data: {
          companyId,
          giftCardId: card.id,
          type: "ISSUE",
          amount: new Prisma.Decimal(data.amount),
          createdById,
        },
      });
      return card;
    });
  }

  async getGiftCardBalance(companyId: string, code: string) {
    const card = await this.prisma.giftCard.findFirst({ where: { companyId, code } });
    if (!card) throw new NotFoundException("Gift card not found");
    return {
      code: card.code,
      balance: card.balance,
      currency: card.currency,
      status: card.status,
      expiresAt: card.expiresAt,
    };
  }

  async listLoyaltyTiers(companyId: string) {
    return this.prisma.loyaltyTier.findMany({ where: { companyId }, orderBy: { minPoints: "asc" } });
  }

  async createLoyaltyTier(companyId: string, data: any) {
    return this.prisma.loyaltyTier.create({
      data: {
        companyId,
        name: data.name,
        minPoints: data.minPoints,
        multiplier: data.multiplier ?? 1,
      },
    });
  }

  async listLoyaltyRules(companyId: string) {
    return this.prisma.loyaltyRule.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  async createLoyaltyRule(companyId: string, data: any) {
    return this.prisma.loyaltyRule.create({
      data: {
        companyId,
        type: data.type,
        config: data.config,
        productId: data.productId ?? null,
        categoryId: data.categoryId ?? null,
      },
    });
  }

  async validateCoupon(companyId: string, input: CouponInput, tx?: PrismaTx) {
    const prisma = this.getPrisma(tx);
    const coupon = await prisma.coupon.findFirst({
      where: { companyId, code: input.code, active: true },
    });
    if (!coupon) return { ok: false, reason: "not_found" };
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "not_started" };
    if (coupon.endsAt && coupon.endsAt < now) return { ok: false, reason: "expired" };
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) return { ok: false, reason: "usage_limit" };
    if (coupon.priceListId && !input.priceListId) return { ok: false, reason: "price_list_required" };
    if (coupon.priceListId && input.priceListId && coupon.priceListId !== input.priceListId) return { ok: false, reason: "price_list" };
    if (coupon.customerId && input.customerId && coupon.customerId !== input.customerId) return { ok: false, reason: "customer" };
    if (coupon.customerId && !input.customerId) return { ok: false, reason: "customer_required" };

    if (coupon.perCustomerLimit && (input.customerId || input.customerEmail)) {
      const redemptionCount = await prisma.couponRedemption.count({
        where: {
          couponId: coupon.id,
          ...(input.customerId ? { customerId: input.customerId } : { email: input.customerEmail }),
        },
      });
      if (redemptionCount >= coupon.perCustomerLimit) return { ok: false, reason: "per_customer_limit" };
    }

    const items = input.items ?? [];
    const subtotal = input.subtotal ?? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (coupon.minSubtotal && subtotal < Number(coupon.minSubtotal)) return { ok: false, reason: "min_subtotal" };

    let eligibleSubtotal = subtotal;
    if (coupon.categoryId && items.length > 0) {
      eligibleSubtotal = items
        .filter((item) => item.categoryIds?.includes(coupon.categoryId ?? ""))
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    }
    if (eligibleSubtotal <= 0 && coupon.type !== CouponType.FREE_SHIPPING) return { ok: false, reason: "no_eligible_items" };

    let discount = 0;
    let freeShipping = false;
    if (coupon.type === CouponType.PERCENT) {
      discount = eligibleSubtotal * (Number(coupon.amount) / 100);
    } else if (coupon.type === CouponType.FIXED) {
      discount = Math.min(Number(coupon.amount), eligibleSubtotal);
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      freeShipping = true;
      discount = Math.min(Number(input.shippingCost ?? 0), Number(coupon.amount) || Number(input.shippingCost ?? 0));
    }

    if (coupon.maxDiscount) {
      discount = Math.min(discount, Number(coupon.maxDiscount));
    }

    return { ok: true, coupon, discount, freeShipping, eligibleSubtotal, subtotal };
  }

  async applyCoupon(companyId: string, input: CouponInput, tx: PrismaTx) {
    const result = await this.validateCoupon(companyId, input, tx);
    if (!result.ok) return result;

    const prisma = this.getPrisma(tx);
    await prisma.coupon.update({
      where: { id: result.coupon.id },
      data: { usageCount: { increment: 1 } },
    });

    return result;
  }

  async redeemCoupon(companyId: string, couponId: string, amount: number, orderId?: string, customerId?: string, email?: string, tx?: PrismaTx) {
    const prisma = this.getPrisma(tx);
    return prisma.couponRedemption.create({
      data: {
        companyId,
        couponId,
        orderId,
        customerId: customerId ?? null,
        email: email ?? null,
        amount: new Prisma.Decimal(amount),
      },
    });
  }

  async applyGiftCard(companyId: string, code: string, amount: number, orderId?: string, tx?: PrismaTx) {
    const prisma = this.getPrisma(tx);
    const card = await prisma.giftCard.findFirst({ where: { companyId, code } });
    if (!card) throw new BadRequestException("Gift card not found");
    if (card.status !== GiftCardStatus.ACTIVE) throw new BadRequestException("Gift card inactive");
    if (card.expiresAt && card.expiresAt < new Date()) throw new BadRequestException("Gift card expired");
    if (Number(card.balance) <= 0) throw new BadRequestException("Gift card empty");

    const applied = Math.min(Number(card.balance), amount);
    const newBalance = Number(card.balance) - applied;
    const status = newBalance <= 0 ? GiftCardStatus.REDEEMED : GiftCardStatus.ACTIVE;

    await prisma.giftCard.update({
      where: { id: card.id },
      data: { balance: new Prisma.Decimal(newBalance), status },
    });
    await prisma.giftCardTransaction.create({
      data: {
        companyId,
        giftCardId: card.id,
        type: "REDEEM",
        amount: new Prisma.Decimal(applied),
        orderId: orderId ?? null,
      },
    });

    return { card, applied, remaining: newBalance };
  }

  async calculateLoyaltyPoints(companyId: string, items: CouponItem[], subtotal: number, customerId?: string) {
    const rules = await this.prisma.loyaltyRule.findMany({ where: { companyId } });
    const earnRateRule = rules.find((rule) => rule.type === LoyaltyRuleType.EARN_RATE);
    const pointsPerCurrency = Number(earnRateRule?.config?.pointsPerArs ?? earnRateRule?.config?.pointsPerCurrency ?? 0.01);
    let points = Math.floor(subtotal * pointsPerCurrency);

    for (const rule of rules) {
      if (rule.type === LoyaltyRuleType.BONUS_PRODUCT && rule.productId) {
        const matchQty = items.filter((item) => item.productId === rule.productId).reduce((sum, item) => sum + item.quantity, 0);
        const perUnit = Number(rule.config?.pointsPerUnit ?? 0);
        points += matchQty * perUnit;
      }
      if (rule.type === LoyaltyRuleType.BONUS_CATEGORY && rule.categoryId) {
        const matchQty = items.filter((item) => item.categoryIds?.includes(rule.categoryId ?? "")).reduce((sum, item) => sum + item.quantity, 0);
        const perUnit = Number(rule.config?.pointsPerUnit ?? 0);
        points += matchQty * perUnit;
      }
    }

    if (customerId) {
      const account = await this.prisma.loyaltyAccount.findUnique({ where: { companyId_customerId: { companyId, customerId } }, include: { tier: true } });
      if (account?.tier?.multiplier) {
        points = Math.floor(points * account.tier.multiplier);
      }
    }

    return points;
  }

  async applyLoyaltyRedeem(companyId: string, customerId: string, pointsToUse: number, orderId?: string, tx?: PrismaTx) {
    if (!pointsToUse || pointsToUse <= 0) return { applied: 0 };
    const prisma = this.getPrisma(tx);
    const account = await prisma.loyaltyAccount.findUnique({ where: { companyId_customerId: { companyId, customerId } } });
    if (!account) throw new BadRequestException("Loyalty account not found");
    if (account.pointsBalance < pointsToUse) throw new BadRequestException("Insufficient points");
    await prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { decrement: pointsToUse } },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        companyId,
        accountId: account.id,
        type: "REDEEM",
        points: pointsToUse,
        orderId: orderId ?? null,
      },
    });
    return { applied: pointsToUse };
  }

  async earnLoyalty(companyId: string, customerId: string, points: number, orderId?: string, tx?: PrismaTx) {
    if (!points || points <= 0) return { earned: 0 };
    const prisma = this.getPrisma(tx);
    const account = await prisma.loyaltyAccount.upsert({
      where: { companyId_customerId: { companyId, customerId } },
      create: { companyId, customerId, pointsBalance: points },
      update: { pointsBalance: { increment: points } },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        companyId,
        accountId: account.id,
        type: "EARN",
        points,
        orderId: orderId ?? null,
      },
    });
    return { earned: points, accountId: account.id };
  }
}
