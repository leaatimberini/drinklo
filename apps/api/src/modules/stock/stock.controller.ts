import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import type { CreateStockItemDto, CreateStockLocationDto, ReceiveStockDto, UpdateStockItemDto } from "./dto/stock.dto";
import { StockService } from "./stock.service";

@ApiTags("stock")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("stock")
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get("locations")
  @Permissions("inventory:read")
  listLocations(@Req() req: any) {
    return this.stock.listLocations(req.user.companyId);
  }

  @Post("locations")
  @Permissions("inventory:write")
  createLocation(@Req() req: any, @Body() body: CreateStockLocationDto) {
    return this.stock.createLocation(req.user.companyId, body, req.user.sub);
  }

  @Get("items")
  @Permissions("inventory:read")
  listItems(@Req() req: any) {
    return this.stock.listItems(req.user.companyId);
  }

  @Get("lookup")
  @Permissions("inventory:read")
  lookup(@Req() req: any, @Query("code") code?: string) {
    return this.stock.lookupByCode(req.user.companyId, code ?? "");
  }

  @Post("items")
  @Permissions("inventory:write")
  createItem(@Req() req: any, @Body() body: CreateStockItemDto) {
    return this.stock.createItem(req.user.companyId, body, req.user.sub);
  }

  @Post("movements/receive")
  @Permissions("inventory:write")
  receive(@Req() req: any, @Body() body: ReceiveStockDto) {
    return this.stock.receiveStock(req.user.companyId, body, req.user.sub);
  }

  @Patch("items/:id")
  @Permissions("inventory:write")
  updateItem(@Req() req: any, @Param("id") id: string, @Body() body: UpdateStockItemDto) {
    return this.stock.updateItem(req.user.companyId, id, body, req.user.sub);
  }
}
