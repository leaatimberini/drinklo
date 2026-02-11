import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { CreateSaleDto, OfflineSyncDto, SaleSearchDto } from "./dto/sales.dto";
import { SalesService } from "./sales.service";

@ApiTags("sales")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get("products")
  @Roles("admin", "manager", "caja")
  search(@Query() query: SaleSearchDto) {
    return this.sales.searchProducts(query.q);
  }

  @Post()
  @Roles("admin", "manager", "caja")
  create(@Body() body: CreateSaleDto) {
    return this.sales.createSale(body);
  }

  @Get("offline/catalog")
  @Roles("admin", "manager", "caja")
  offlineCatalog(@Query("updatedSince") updatedSince?: string) {
    return this.sales.getOfflineCatalog(updatedSince);
  }

  @Post("offline/sync")
  @Roles("admin", "manager", "caja")
  offlineSync(@Body() body: OfflineSyncDto) {
    return this.sales.syncOfflineSales(body.drafts);
  }
}
