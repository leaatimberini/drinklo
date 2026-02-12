import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { CatalogQueryDto } from "./dto/catalog-query.dto";
import { EdgeCacheHeaders } from "../edge-cache/edge-cache.types";

@ApiTags("catalog")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  @Header("Cache-Control", EdgeCacheHeaders.catalog)
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get("products")
  @Header("Cache-Control", EdgeCacheHeaders.catalog)
  listProducts(@Query() query: CatalogQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:id")
  @Header("Cache-Control", EdgeCacheHeaders.catalog)
  async getProduct(@Param("id") id: string) {
    const product = await this.catalog.getProduct(id);
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  @Post("cart/sync")
  syncCart(@Body() body: any) {
    return this.catalog.syncCart(body);
  }
}
