import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PluginsService } from "../plugins/plugins.service";
import type { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { CatalogService } from "../catalog/catalog.service";
import { EdgeCacheService } from "../edge-cache/edge-cache.service";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plugins: PluginsService,
    private readonly catalog: CatalogService,
    private readonly edgeCache: EdgeCacheService,
  ) {}

  async list(companyId: string) {
    const items = await this.prisma.product.findMany({
      where: { companyId, deletedAt: null },
      include: { variants: true },
    });
    return Promise.all(items.map((item) => this.plugins.decorateProduct(companyId, item)));
  }

  async get(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { variants: true },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return this.plugins.decorateProduct(companyId, product);
  }

  async create(companyId: string, dto: CreateProductDto, createdById?: string) {
    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          companyId,
          name: dto.name,
          description: dto.description,
          imageUrl: dto.imageUrl,
          isAlcoholic: dto.isAlcoholic ?? false,
          abv: dto.abv,
          createdById,
          updatedById: createdById,
        },
      });

      await tx.productVariant.create({
        data: {
          companyId,
          productId: product.id,
          name: "Default",
          sku: dto.sku ?? `SKU-${product.id.slice(0, 8)}`,
          createdById,
          updatedById: createdById,
        },
      });

      return product;
    });

    this.catalog.invalidateAll();
    await this.edgeCache.purgeProduct(companyId, product.id, "product_created");
    return product;
  }

  async update(companyId: string, id: string, dto: UpdateProductDto, updatedById?: string) {
    await this.get(companyId, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        imageUrl: dto.imageUrl ?? undefined,
        isAlcoholic: dto.isAlcoholic ?? undefined,
        abv: dto.abv ?? undefined,
        updatedById,
      },
    });
    this.catalog.invalidateAll();
    await this.edgeCache.purgeProduct(companyId, product.id, "product_updated");
    return product;
  }

  async remove(companyId: string, id: string, updatedById?: string) {
    await this.get(companyId, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById },
    });
    this.catalog.invalidateAll();
    await this.edgeCache.purgeProduct(companyId, product.id, "product_deleted");
    return product;
  }
}
