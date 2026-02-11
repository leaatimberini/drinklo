import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { CatalogQueryDto } from "./dto/catalog-query.dto";

@ApiTags("catalog")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get("products")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  listProducts(@Query() query: CatalogQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:id")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
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
