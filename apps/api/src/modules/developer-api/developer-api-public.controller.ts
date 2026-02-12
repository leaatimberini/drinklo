import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiHeader, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { DeveloperApiService } from "./developer-api.service";
import { DeveloperApiKeyGuard } from "./developer-api-key.guard";
import { DeveloperApiScopes } from "./scopes.decorator";
import { DeveloperApiUsageInterceptor } from "./developer-api-usage.interceptor";

class ProductsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@ApiTags("developer-api-public")
@ApiHeader({ name: "x-api-key", required: true, description: "Developer API key" })
@ApiSecurity("developerApiKey")
@UseGuards(DeveloperApiKeyGuard)
@UseInterceptors(DeveloperApiUsageInterceptor)
@Controller("developer/v1")
export class DeveloperApiPublicController {
  constructor(private readonly developerApi: DeveloperApiService) {}

  @Get("products")
  @DeveloperApiScopes("read:products")
  listProducts(@Req() req: any, @Query() query: ProductsQueryDto) {
    return this.developerApi.listProducts(req.developerApi.companyId, query.q, query.page ?? 1, query.pageSize ?? 50);
  }

  @Get("categories")
  @DeveloperApiScopes("read:categories")
  listCategories(@Req() req: any) {
    return this.developerApi.listCategories(req.developerApi.companyId);
  }

  @Get("pricelists")
  @DeveloperApiScopes("read:pricelists")
  listPriceLists(@Req() req: any) {
    return this.developerApi.listPriceLists(req.developerApi.companyId);
  }

  @Get("stock/availability")
  @DeveloperApiScopes("read:stock")
  listStockAvailability(@Req() req: any) {
    return this.developerApi.listStockAvailability(req.developerApi.companyId);
  }
}
