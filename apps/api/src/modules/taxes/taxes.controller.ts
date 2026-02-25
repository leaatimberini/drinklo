import { Body, Controller, Get, Put, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions, SodAction } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { ReplaceTaxRulesDto, TaxSimulateDto, UpsertTaxProfileDto } from "./dto/taxes.dto";
import { TaxesService } from "./taxes.service";

@ApiTags("taxes")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/taxes")
export class TaxesAdminController {
  constructor(private readonly taxes: TaxesService) {}

  @Get("profile")
  @Permissions("pricing:read")
  getProfile(@Req() req: any) {
    return this.taxes.getProfile(req.user.companyId);
  }

  @Put("profile")
  @Permissions("pricing:write")
  @SodAction("PRICING_CONFIGURE")
  upsertProfile(@Req() req: any, @Body() body: UpsertTaxProfileDto) {
    return this.taxes.upsertProfile(req.user.companyId, body, req.user.sub);
  }

  @Get("rules")
  @Permissions("pricing:read")
  listRules(@Req() req: any) {
    return this.taxes.listRules(req.user.companyId);
  }

  @Put("rules")
  @Permissions("pricing:write")
  @SodAction("PRICING_CONFIGURE")
  replaceRules(@Req() req: any, @Body() body: ReplaceTaxRulesDto) {
    return this.taxes.replaceRules(req.user.companyId, body, req.user.sub);
  }

  @Post("simulate")
  @Permissions("pricing:read")
  simulate(@Req() req: any, @Body() body: TaxSimulateDto) {
    return this.taxes.simulate(req.user.companyId, body);
  }
}
