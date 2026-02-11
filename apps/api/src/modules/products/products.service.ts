import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PluginsService } from "../plugins/plugins.service";
import type { CreateProductDto, UpdateProductDto } from "./dto/product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plugins: PluginsService,
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
    return this.prisma.$transaction(async (tx) => {
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
  }

  async update(companyId: string, id: string, dto: UpdateProductDto, updatedById?: string) {
    await this.get(companyId, id);
    return this.prisma.product.update({
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
  }

  async remove(companyId: string, id: string, updatedById?: string) {
    await this.get(companyId, id);
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById },
    });
  }
}
