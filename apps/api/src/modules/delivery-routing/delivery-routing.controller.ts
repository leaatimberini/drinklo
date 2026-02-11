import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { DeliveryRoutingService } from "./delivery-routing.service";
import { CreateDeliveryWindowDto, GenerateRouteDto, UpdateStopStatusDto } from "./dto/delivery-routing.dto";

@ApiTags("delivery")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/delivery")
export class DeliveryRoutingController {
  constructor(private readonly routing: DeliveryRoutingService) {}

  @Get("windows")
  @Roles("admin", "manager")
  listWindows(@Req() req: any) {
    return this.routing.listWindows(req.user.companyId);
  }

  @Post("windows")
  @Roles("admin", "manager")
  createWindow(@Req() req: any, @Body() body: CreateDeliveryWindowDto) {
    return this.routing.createWindow(req.user.companyId, body);
  }

  @Get("routes")
  @Roles("admin", "manager", "deposito")
  listRoutes(@Req() req: any, @Query("date") date?: string) {
    return this.routing.listRoutes(req.user.companyId, date);
  }

  @Post("routes/generate")
  @Roles("admin", "manager")
  generate(@Req() req: any, @Body() body: GenerateRouteDto) {
    return this.routing.generateRoute(req.user.companyId, body);
  }

  @Post("stops/:id/status")
  @Roles("admin", "manager", "deposito")
  updateStop(@Req() req: any, @Param("id") id: string, @Body() body: UpdateStopStatusDto) {
    return this.routing.updateStopStatus(req.user.companyId, id, body.status);
  }
}
