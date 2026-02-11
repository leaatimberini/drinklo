import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PluginsService } from "../plugins/plugins.service";
import type { CatalogQueryDto } from "./dto/catalog-query.dto";

const CACHE_TTL_MS = 30_000;

type CacheEntry<T> = { value: T; expiresAt: number };

@Injectable()
export class CatalogService {
  private cache = new Map<string, CacheEntry<any>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly plugins: PluginsService,
  ) {}

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setCached<T>(key: string, value: T) {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async listCategories() {
    const cached = this.getCached<any>("categories");
    if (cached) return cached;

    const items = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    const payload = { items };
    this.setCached("categories", payload);
    return payload;
  }

  async listProducts(query: CatalogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const q = query.q?.trim();
    const categoryId = query.categoryId;

    const key = JSON.stringify({ q, categoryId, page, pageSize });
    const cached = this.getCached<any>(`products:${key}`);
    if (cached) return cached;

    const where: any = {
      deletedAt: null,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        { variants: { some: { barcode: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (categoryId) {
      where.productCats = { some: { categoryId } };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { variants: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const company = await this.prisma.company.findFirst();
    const companyId = company?.id;
    const decorated = companyId
      ? await Promise.all(items.map((item) => this.plugins.decorateProduct(companyId, item)))
      : items;
    const payload = { items: decorated, total, page, pageSize };
    this.setCached(`products:${key}`, payload);
    return payload;
  }

  async getProduct(id: string) {
    const cached = this.getCached<any>(`product:${id}`);
    if (cached) return cached;

    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: true, productCats: { include: { category: true } } },
    });

    if (!product) {
      return null;
    }

    const company = await this.prisma.company.findFirst();
    const decorated = company ? await this.plugins.decorateProduct(company.id, product) : product;
    this.setCached(`product:${id}`, decorated);
    return decorated;
  }

  async syncCart(payload: any) {
    return { ok: true, received: payload?.items?.length ?? 0 };
  }
}
