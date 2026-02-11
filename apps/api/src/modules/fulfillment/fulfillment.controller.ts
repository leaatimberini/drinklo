import { Controller, Get, Param, Post, Body, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { FulfillmentService } from "./fulfillment.service";
import { FulfillmentQueryDto, UpdateOrderStatusDto } from "./dto/fulfillment.dto";
import { OrderStatus } from "@erp/db";

@ApiTags("fulfillment")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("fulfillment")
export class FulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get("orders")
  @Roles("admin", "manager", "deposito")
  list(@Req() req: any, @Query() query: FulfillmentQueryDto) {
    return this.fulfillment.listOrders(req.user.companyId, query.status);
  }

  @Post("orders/:id/status")
  @Roles("admin", "manager", "deposito")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.fulfillment.updateStatus(req.user.companyId, id, body.status as OrderStatus, req.user.sub);
  }
}
