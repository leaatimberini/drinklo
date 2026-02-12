import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { LotsService } from "./lots.service";
import { LotAlertsQueryDto, RotationSuggestionsQueryDto, UpdateFefoConfigDto } from "./dto/lots.dto";

@ApiTags("lots")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("stock/lots")
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  @Get("config")
  @Permissions("inventory:read")
  config(@Req() req: any) {
    return this.lots.getConfig(req.user.companyId);
  }

  @Patch("config")
  @Permissions("inventory:write")
  updateConfig(@Req() req: any, @Body() body: UpdateFefoConfigDto) {
    return this.lots.updateConfig(req.user.companyId, body.pickingStrategy, body.blockExpiredLotSale ?? false);
  }

  @Get("alerts")
  @Permissions("inventory:read")
  alerts(@Req() req: any, @Query() query: LotAlertsQueryDto) {
    return this.lots.expiryAlerts(req.user.companyId, query.days ?? 30);
  }

  @Get("alerts/windows")
  @Permissions("inventory:read")
  windows(@Req() req: any) {
    return this.lots.expiryAlertsWindows(req.user.companyId);
  }

  @Get("rotation")
  @Permissions("inventory:read")
  rotation(@Req() req: any, @Query() query: RotationSuggestionsQueryDto) {
    return this.lots.rotationSuggestions(req.user.companyId, query.limit ?? 20);
  }

  @Get("product/:productId")
  @Permissions("inventory:read")
  product(@Req() req: any, @Param("productId") productId: string) {
    return this.lots.productNearExpiry(req.user.companyId, productId);
  }
}
