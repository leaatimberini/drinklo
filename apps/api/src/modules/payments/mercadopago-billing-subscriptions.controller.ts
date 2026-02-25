import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../common/permissions.guard";
import { Permissions } from "../common/rbac.decorators";
import { IsBoolean, IsOptional } from "class-validator";
import { MercadoPagoBillingSubscriptionsService } from "./mercadopago-billing-subscriptions.service";

class UpsertBillingPreapprovalDto {
  @IsOptional()
  @IsBoolean()
  allowDuringTrial?: boolean;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}

@ApiTags("mercadopago-billing-subscriptions")
@ApiBearerAuth()
@Controller("billing/mercadopago/subscriptions")
export class MercadoPagoBillingSubscriptionsController {
  constructor(private readonly recurring: MercadoPagoBillingSubscriptionsService) {}

  @Get("status")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  status(@Req() req: any) {
    return this.recurring.getStatus(req.user.companyId);
  }

  @Post("preapproval")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  upsert(@Req() req: any, @Body() body: UpsertBillingPreapprovalDto) {
    return this.recurring.createOrUpdatePreapproval(req.user.companyId, {
      allowDuringTrial: Boolean(body.allowDuringTrial),
      activate: Boolean(body.activate),
      actorUserId: req.user.sub,
    });
  }
}

