import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { MeiliSearch } from "meilisearch";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

const DEFAULT_SEARCH_LIMIT = 20;
const INDEX_NAME_PREFIX = "catalog";

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  private connection?: IORedis;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? "";
    if (!redisUrl) return;

    this.connection = new IORedis(redisUrl);
    this.queue = new Queue("search-index", { connection: this.connection });
    this.worker = new Worker(
      "search-index",
      async (job) => {
        const { companyId, mode } = job.data ?? {};
        if (!companyId) return;
        if (mode === "incremental") {
          await this.incrementalReindex(companyId);
        } else {
          await this.fullReindex(companyId);
        }
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private getClient() {
    const host = process.env.MEILI_HOST ?? "";
    if (!host) {
      throw new BadRequestException("MEILI_HOST not configured");
    }
    return new MeiliSearch({ host, apiKey: process.env.MEILI_API_KEY ?? undefined });
  }

  private indexName(companyId: string) {
    return `${INDEX_NAME_PREFIX}_${companyId}`;
  }

  async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return company;
  }

  async getConfig(companyId: string) {
    const existing = await this.prisma.searchConfig.findUnique({ where: { companyId } });
    if (existing) return existing;
    return this.prisma.searchConfig.create({
      data: {
        companyId,
        synonyms: {},
        boosters: { stockWeight: 1, marginWeight: 1 },
      },
    });
  }

  async updateConfig(companyId: string, data: { synonyms?: Record<string, string[]>; boosters?: unknown }) {
    const config = await this.prisma.searchConfig.upsert({
      where: { companyId },
      update: {
        synonyms: data.synonyms ?? undefined,
        boosters: data.boosters ?? undefined,
      },
      create: {
        companyId,
        synonyms: data.synonyms ?? {},
        boosters: data.boosters ?? { stockWeight: 1, marginWeight: 1 },
      },
    });

    await this.applySettings(companyId, config);
    return config;
  }

  async applySettings(companyId: string, config: { synonyms?: unknown; boosters?: unknown }) {
    const client = this.getClient();
    const index = client.index(this.indexName(companyId));
    const synonyms = config.synonyms ?? {};

    await index.updateSettings({
      searchableAttributes: ["name", "sku", "barcode", "categoryNames", "brand"],
      filterableAttributes: ["type", "categoryIds", "brand"],
      rankingRules: [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
        "desc(stockScore)",
        "desc(marginScore)",
      ],
    });
    await index.updateSynonyms(synonyms);
  }

  async enqueueReindex(companyId: string, mode: "full" | "incremental") {
    if (!this.queue) {
      throw new BadRequestException("Search queue not configured");
    }
    await this.queue.add("search-index", { companyId, mode }, { removeOnComplete: true, removeOnFail: true });
    return { ok: true };
  }

  @Cron("*/5 * * * *")
  async scheduleIncremental() {
    try {
      const company = await this.getCompany();
      if (!company || !this.queue) return;
      await this.enqueueReindex(company.id, "incremental");
    } catch {
      // ignore scheduler errors
    }
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
    index: ReturnType<SearchService["buildRuleIndex"]>,
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

  private async fetchIndexData(companyId: string, updatedSince?: Date) {
    const productWhere: Prisma.ProductWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (updatedSince) {
      productWhere.OR = [
        { updatedAt: { gt: updatedSince } },
        { variants: { some: { updatedAt: { gt: updatedSince } } } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where: productWhere,
      include: {
        variants: { where: { deletedAt: null } },
        productCats: { include: { category: true } },
        attributes: true,
      },
    });

    const deletedProducts = updatedSince
      ? await this.prisma.product.findMany({
          where: {
            companyId,
            deletedAt: { not: null },
            updatedAt: { gt: updatedSince },
          },
          include: { variants: true },
        })
      : [];

    const categories = await this.prisma.category.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(updatedSince ? { updatedAt: { gt: updatedSince } } : {}),
      },
    });

    const deletedCategories = updatedSince
      ? await this.prisma.category.findMany({
          where: { companyId, deletedAt: { not: null }, updatedAt: { gt: updatedSince } },
        })
      : [];

    const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));

    const priceListId = await this.getDefaultPriceListId(companyId);
    const priceRules = await this.prisma.priceRule.findMany({
      where: {
        companyId,
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

    const stock = await this.prisma.stockItem.groupBy({
      by: ["variantId"],
      where: { companyId, deletedAt: null, variantId: { in: variantIds } },
      _sum: { quantity: true },
    });
    const stockMap = new Map(stock.map((row) => [row.variantId, row._sum.quantity ?? 0]));

    return { products, categories, deletedProducts, deletedCategories, priceIndex, stockMap };
  }

  private mapBrand(attributes: Array<{ key: string; value: string }>) {
    const candidate = attributes.find((attr) => ["brand", "marca"].includes(attr.key.toLowerCase()));
    return candidate?.value ?? null;
  }

  private buildDocuments(
    companyId: string,
    data: Awaited<ReturnType<SearchService["fetchIndexData"]>>,
    config: { boosters?: unknown },
  ) {
    const stockWeight = Number(config.boosters?.stockWeight ?? 1);
    const marginWeight = Number(config.boosters?.marginWeight ?? 1);

    const brandSet = new Set<string>();
    const docs: Array<Record<string, unknown>> = [];

    for (const product of data.products) {
      const categoryIds = product.productCats.map((c) => c.categoryId);
      const categoryNames = product.productCats.map((c) => c.category.name);
      const brand = this.mapBrand(product.attributes);
      if (brand) brandSet.add(brand);

      for (const variant of product.variants) {
        const stockQty = data.stockMap.get(variant.id) ?? 0;
        const price = this.resolveUnitPrice(data.priceIndex, product.id, variant.id, 1)?.toNumber() ?? 0;
        const cost = variant.cost?.toNumber() ?? 0;
        const margin = Math.max(0, price - cost);

        docs.push({
          id: `variant:${variant.id}`,
          type: "variant",
          companyId,
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          description: product.description ?? null,
          sku: variant.sku,
          barcode: variant.barcode ?? null,
          categoryIds,
          categoryNames,
          brand,
          price,
          stock: stockQty,
          margin,
          stockScore: stockQty * stockWeight,
          marginScore: margin * marginWeight,
          updatedAt: variant.updatedAt.toISOString(),
        });
      }
    }

    for (const category of data.categories) {
      docs.push({
        id: `category:${category.id}`,
        type: "category",
        companyId,
        categoryId: category.id,
        name: category.name,
        slug: category.slug ?? null,
      });
    }

    for (const brand of brandSet) {
      docs.push({
        id: `brand:${brand}`,
        type: "brand",
        companyId,
        name: brand,
        brand,
      });
    }

    const deletedIds: string[] = [];
    for (const product of data.deletedProducts) {
      for (const variant of product.variants) {
        deletedIds.push(`variant:${variant.id}`);
      }
    }
    for (const category of data.deletedCategories) {
      deletedIds.push(`category:${category.id}`);
    }

    return { docs, deletedIds };
  }

  async fullReindex(companyId: string) {
    const client = this.getClient();
    const index = client.index(this.indexName(companyId));
    const config = await this.getConfig(companyId);

    const data = await this.fetchIndexData(companyId);
    const { docs } = this.buildDocuments(companyId, data, config);

    await this.applySettings(companyId, config);
    if (docs.length > 0) {
      await index.addDocuments(docs, { primaryKey: "id" });
    }

    await this.prisma.searchIndexState.upsert({
      where: { companyId },
      update: { lastIndexedAt: new Date() },
      create: { companyId, lastIndexedAt: new Date() },
    });

    return { indexed: docs.length };
  }

  async incrementalReindex(companyId: string) {
    const state = await this.prisma.searchIndexState.findUnique({ where: { companyId } });
    if (!state?.lastIndexedAt) {
      return this.fullReindex(companyId);
    }

    const client = this.getClient();
    const index = client.index(this.indexName(companyId));
    const config = await this.getConfig(companyId);

    const data = await this.fetchIndexData(companyId, state.lastIndexedAt);
    const { docs, deletedIds } = this.buildDocuments(companyId, data, config);

    if (deletedIds.length > 0) {
      await index.deleteDocuments(deletedIds);
    }
    if (docs.length > 0) {
      await index.addDocuments(docs, { primaryKey: "id" });
    }

    await this.prisma.searchIndexState.update({
      where: { companyId },
      data: { lastIndexedAt: new Date() },
    });

    return { indexed: docs.length, deleted: deletedIds.length };
  }

  async searchCatalog(companyId: string, query: string, limit = DEFAULT_SEARCH_LIMIT, offset = 0) {
    const client = this.getClient();
    const index = client.index(this.indexName(companyId));
    const res = await index.search(query, {
      limit,
      offset,
      attributesToRetrieve: [
        "id",
        "type",
        "name",
        "sku",
        "barcode",
        "price",
        "stock",
        "productId",
        "variantId",
        "categoryNames",
        "brand",
      ],
    });

    const suggestions = (res.hits ?? []).map((hit: unknown) => hit.name).filter(Boolean).slice(0, 5);
    const didYouMean = res.hits?.length === 0 && suggestions.length > 0 ? suggestions[0] : null;

    return {
      query: res.query,
      hits: res.hits,
      estimatedTotalHits: res.estimatedTotalHits,
      suggestions,
      didYouMean,
    };
  }
}


