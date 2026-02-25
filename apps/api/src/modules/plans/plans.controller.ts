import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { PlansService } from "./plans.service";
import { SetNextTierDto, UpdateRestrictedModeVariantDto } from "./dto/plans.dto";

@ApiTags("plans")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get("admin/plans/catalog")
  @Roles("admin", "manager", "support")
  catalog() {
    return this.plans.getPlanCatalog();
  }

  @Get("admin/plans/subscription")
  @Roles("admin", "manager", "support")
  subscription(@Req() req: any) {
    return this.plans.getSubscription(req.user.companyId);
  }

  @Get("admin/plans/entitlements")
  @Roles("admin", "manager", "support")
  entitlements(@Req() req: any) {
    return this.plans.getEffective(req.user.companyId);
  }

  @Get("admin/plans/usage/current")
  @Roles("admin", "manager", "support")
  usage(@Req() req: any) {
    return this.plans.getCurrentUsage(req.user.companyId);
  }

  @Get("admin/plans/restricted-mode")
  @Roles("admin", "support")
  restrictedMode(@Req() req: any) {
    return this.plans.getRestrictedModeConfig(req.user.companyId);
  }

  @Post("admin/plans/restricted-mode")
  @Roles("admin", "support")
  setRestrictedMode(@Req() req: any, @Body() body: UpdateRestrictedModeVariantDto) {
    return this.plans.setRestrictedModeVariant(req.user.companyId, body.variant);
  }

  @Get("admin/support/plans/:companyId/entitlements")
  @Roles("admin", "support")
  supportEntitlements(@Param("companyId") companyId: string) {
    return this.plans.getSupportEntitlements(companyId);
  }

  @Post("admin/support/plans/:companyId/next-tier")
  @Roles("admin", "support")
  setNextTier(@Param("companyId") companyId: string, @Body() body: SetNextTierDto) {
    return this.plans.setNextTier(companyId, body.nextTier ?? null);
  }

  @Post("admin/support/plans/:companyId/restricted-mode")
  @Roles("admin", "support")
  supportSetRestrictedMode(@Param("companyId") companyId: string, @Body() body: UpdateRestrictedModeVariantDto) {
    return this.plans.setRestrictedModeVariant(companyId, body.variant);
  }
}
