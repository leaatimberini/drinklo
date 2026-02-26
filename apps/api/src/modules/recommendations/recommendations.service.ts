import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

export type RecommendationItem = {
  productId: string;
  variantId: string;
  name: string;
  sku?: string | null;
  price: number;
  stock: number;
  reason: string;
};

export type RecommendationsBlock = {
  items: RecommendationItem[];
  segment?: string | null;
};

const DEFAULT_LIMIT = 6;

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  private async getSettings(companyId: string) {
    return this.prisma.companySettings.findFirst({ where: { companyId } });
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
      throw new Error("No price list configured");
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
    index: ReturnType<RecommendationsService["buildRuleIndex"]>,
    productId: string,
    variantId: string,
    quantity: number,
  ) {
    const variantRules = index.variantRules.get(variantId) ?? [];
    const rule = variantRules.find((candidate) => candidate.minQty <= quantity);
    if (rule) return rule.price;

    const productRules = index.productRules.get(productId) ?? [];
    const productRule = productRules.find((candidate) => candidate.minQty <= quantity);
    return productRule?.price ?? null;
  }

  private async getStockMap(companyId: string, variantIds: string[]) {
    if (variantIds.length === 0) return new Map<string, number>();
    const stock = await this.prisma.stockItem.groupBy({
      by: ["variantId"],
      where: { companyId, deletedAt: null, variantId: { in: variantIds } },
      _sum: { quantity: true },
    });
    return new Map(stock.map((row) => [row.variantId, row._sum.quantity ?? 0]));
  }

  private async loadPricing(companyId: string, productIds: string[], variantIds: string[]) {
    if (productIds.length === 0 && variantIds.length === 0) {
      return this.buildRuleIndex([]);
    }
    const priceListId = await this.getDefaultPriceListId(companyId);
    const priceRules = await this.prisma.priceRule.findMany({
      where: {
        companyId,
        priceListId,
        deletedAt: null,
        OR: [{ variantId: { in: variantIds } }, { productId: { in: productIds } }],
      },
      select: { variantId: true, productId: true, minQty: true, price: true },
    });
    return this.buildRuleIndex(priceRules);
  }

  private pickVariant(
    product: { variants: Array<{ id: string; sku: string | null; cost: Prisma.Decimal | null }> },
    stockMap: Map<string, number>,
  ) {
    const variants = product.variants
      .map((variant) => ({
        variant,
        stock: stockMap.get(variant.id) ?? 0,
      }))
      .filter((item) => item.stock > 0);

    if (variants.length === 0) {
      return null;
    }
    variants.sort((a, b) => b.stock - a.stock);
    return variants[0];
  }

  private buildItems(
    products: Array<{ id: string; name: string; variants: Array<{ id: string; sku: string | null; cost: Prisma.Decimal | null }> }>,
    stockMap: Map<string, number>,
    priceIndex: ReturnType<RecommendationsService["buildRuleIndex"]>,
    reason: string,
  ) {
    const items: RecommendationItem[] = [];

    for (const product of products) {
      const selection = this.pickVariant(product, stockMap);
      if (!selection) continue;

      const price = this.resolveUnitPrice(priceIndex, product.id, selection.variant.id, 1)?.toNumber() ?? 0;
      items.push({
        productId: product.id,
        variantId: selection.variant.id,
        name: product.name,
        sku: selection.variant.sku ?? null,
        price,
        stock: selection.stock,
        reason,
      });
    }

    return items;
  }

  private async getTopProductsFromEvents(companyId: string, limit: number) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const events = await this.prisma.eventLog.findMany({
      where: {
        companyId,
        name: { in: ["PurchaseCompleted", "AddToCart", "ProductViewed"] },
        occurredAt: { gte: since },
      },
      select: { payload: true },
    });

    const counts = new Map<string, number>();
    for (const event of events) {
      const payload = event.payload as Record<string, unknown>;
      const productId = payload.productId ?? payload.productIds?.[0];
      if (!productId) continue;
      counts.set(productId, (counts.get(productId) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);
  }

  private async getTopProductsFromOrders(companyId: string, limit: number) {
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const items = await this.prisma.orderItem.findMany({
      where: { order: { companyId, createdAt: { gte: since } } },
      select: { productId: true, quantity: true },
    });

    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.productId, (counts.get(item.productId) ?? 0) + item.quantity);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);
  }

  private async computeRfm(companyId: string, customerEmail?: string | null) {
    if (!customerEmail) return null;
    const since = new Date();
    since.setDate(since.getDate() - 180);

    const orders = await this.prisma.order.findMany({
      where: { companyId, customerEmail, createdAt: { gte: since } },
      select: { createdAt: true, subtotal: true, discountTotal: true, shippingCost: true },
      orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) return null;
    const recencyDays = Math.floor((Date.now() - orders[0].createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const frequency = orders.length;
    const monetary = orders.reduce(
      (sum, o) => sum + Number(o.subtotal ?? 0) + Number(o.shippingCost ?? 0) - Number(o.discountTotal ?? 0),
      0,
    );

    let segment = "new";
    if (recencyDays <= 30 && frequency >= 3) segment = "loyal";
    else if (recencyDays <= 30 && frequency >= 1) segment = "recent";
    else if (recencyDays > 60 && frequency >= 2) segment = "at_risk";

    return { recencyDays, frequency, monetary, segment };
  }

  private async reorderCandidates(companyId: string, customerEmail?: string | null, limit = DEFAULT_LIMIT) {
    const since = new Date();
    since.setDate(since.getDate() - 120);

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          companyId,
          createdAt: { gte: since },
          ...(customerEmail ? { customerEmail } : {}),
        },
      },
      select: { productId: true, order: { select: { createdAt: true } } },
    });

    const stats = new Map<string, { count: number; lastAt: Date }>();
    for (const item of items) {
      const entry = stats.get(item.productId) ?? { count: 0, lastAt: new Date(0) };
      entry.count += 1;
      if (item.order.createdAt > entry.lastAt) {
        entry.lastAt = item.order.createdAt;
      }
      stats.set(item.productId, entry);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    return Array.from(stats.entries())
      .filter(([, stat]) => stat.count >= 2 && stat.lastAt < cutoff)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([productId]) => productId);
  }

  private async crossSellCandidates(companyId: string, cartProductIds: string[], limit = DEFAULT_LIMIT) {
    if (cartProductIds.length === 0) return [] as string[];
    const since = new Date();
    since.setDate(since.getDate() - 180);

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { companyId, createdAt: { gte: since } },
      },
      select: { orderId: true, productId: true },
    });

    const orderMap = new Map<string, Set<string>>();
    for (const item of items) {
      if (!orderMap.has(item.orderId)) orderMap.set(item.orderId, new Set());
      orderMap.get(item.orderId)!.add(item.productId);
    }

    const counts = new Map<string, number>();
    for (const products of orderMap.values()) {
      const hasAny = cartProductIds.some((id) => products.has(id));
      if (!hasAny) continue;
      for (const productId of products) {
        if (cartProductIds.includes(productId)) continue;
        counts.set(productId, (counts.get(productId) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);
  }

  private async upsellCandidates(companyId: string, cartProductIds: string[], limit = DEFAULT_LIMIT) {
    const productIds = cartProductIds.length > 0 ? cartProductIds : [];
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds.length > 0 ? productIds : undefined }, deletedAt: null },
      include: { productCats: true },
    });
    const categoryIds = new Set(products.flatMap((p) => p.productCats.map((c) => c.categoryId)));

    const candidates = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(categoryIds.size > 0 ? { productCats: { some: { categoryId: { in: Array.from(categoryIds) } } } } : {}),
      },
      include: { variants: true },
    });

    const variantIds = candidates.flatMap((p) => p.variants.map((v) => v.id));
    const stockMap = await this.getStockMap(companyId, variantIds);
    const priceIndex = await this.loadPricing(companyId, candidates.map((p) => p.id), variantIds);

    const items = candidates
      .map((product) => {
        const selection = this.pickVariant(product, stockMap);
        if (!selection) return null;
        const price = this.resolveUnitPrice(priceIndex, product.id, selection.variant.id, 1)?.toNumber() ?? 0;
        const cost = selection.variant.cost?.toNumber() ?? 0;
        const margin = price - cost;
        return { product, selection, price, margin };
      })
      .filter(Boolean) as Array<unknown>;

    return items
      .sort((a, b) => b.margin - a.margin)
      .slice(0, limit)
      .map((item) => item.product.id);
  }

  async getRecommendations(params: {
    companyId: string;
    blocks: string[];
    limit: number;
    cartProductIds: string[];
    customerEmail?: string | null;
    ageVerified: boolean;
    optOut: boolean;
  }) {
    if (params.optOut) {
      return { blocks: {}, segment: null };
    }

    const settings = await this.getSettings(params.companyId);
    const allowAlcohol = settings?.ageGateMode === "DISABLED" || params.ageVerified;

    const baseProductFilter: Prisma.ProductWhereInput = {
      companyId: params.companyId,
      deletedAt: null,
      ...(allowAlcohol ? {} : { isAlcoholic: false }),
    };

    const segment = await this.computeRfm(params.companyId, params.customerEmail ?? null);

    const blocks: Record<string, RecommendationsBlock> = {};

    const reorderProductIds = params.blocks.includes("reorder")
      ? await this.reorderCandidates(params.companyId, params.customerEmail ?? null, params.limit)
      : [];

    const fallbackReorder = reorderProductIds.length === 0
      ? await this.getTopProductsFromEvents(params.companyId, params.limit)
      : [];

    if (params.blocks.includes("reorder")) {
      const productIds = reorderProductIds.length > 0 ? reorderProductIds : fallbackReorder;
      const products = await this.prisma.product.findMany({
        where: { ...baseProductFilter, id: { in: productIds } },
        include: { variants: true },
      });
      const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
      const stockMap = await this.getStockMap(params.companyId, variantIds);
      const priceIndex = await this.loadPricing(params.companyId, products.map((p) => p.id), variantIds);
      blocks.reorder = {
        items: this.buildItems(products, stockMap, priceIndex, "recomprar"),
        segment: segment?.segment ?? null,
      };
    }

    if (params.blocks.includes("cross")) {
      const productIds = await this.crossSellCandidates(params.companyId, params.cartProductIds, params.limit);
      const fallback = productIds.length === 0 ? await this.getTopProductsFromOrders(params.companyId, params.limit) : [];
      const ids = productIds.length > 0 ? productIds : fallback;
      const products = await this.prisma.product.findMany({
        where: { ...baseProductFilter, id: { in: ids } },
        include: { variants: true },
      });
      const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
      const stockMap = await this.getStockMap(params.companyId, variantIds);
      const priceIndex = await this.loadPricing(params.companyId, products.map((p) => p.id), variantIds);
      blocks.cross = {
        items: this.buildItems(products, stockMap, priceIndex, "cross-sell"),
      };
    }

    if (params.blocks.includes("upsell")) {
      const productIds = await this.upsellCandidates(params.companyId, params.cartProductIds, params.limit);
      const products = await this.prisma.product.findMany({
        where: { ...baseProductFilter, id: { in: productIds } },
        include: { variants: true },
      });
      const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
      const stockMap = await this.getStockMap(params.companyId, variantIds);
      const priceIndex = await this.loadPricing(params.companyId, products.map((p) => p.id), variantIds);
      blocks.upsell = {
        items: this.buildItems(products, stockMap, priceIndex, "upsell"),
      };
    }

    return { blocks, segment: segment?.segment ?? null };
  }
}
