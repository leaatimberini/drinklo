import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { SuperAdminGuard } from "../branding/superadmin.guard";
import { LicensingService } from "./licensing.service";
import { LicenseApplyDto, LicenseGenerateDto } from "./dto/license.dto";
import { PremiumFeatures } from "./license.types";

@ApiTags("licensing")
@Controller("admin/license")
export class LicensingController {
  constructor(private readonly licensing: LicensingService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  status(@Req() req: any) {
    return this.licensing.getStatus(req.user.companyId);
  }

  @Post("apply")
  @UseGuards(SuperAdminGuard)
  apply(@Req() req: any, @Body() body: LicenseApplyDto) {
    return this.licensing.apply(req.user.companyId, body.licenseKey);
  }

  @Post("generate")
  @UseGuards(SuperAdminGuard)
  generate(@Req() req: any, @Body() body: LicenseGenerateDto) {
    return this.licensing.generate(req.user.companyId, body.plan, body.expiresAt, body.features ?? []);
  }

  @Get("enforcement")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  enforcement(@Req() req: any) {
    const feature = req.query?.feature as keyof typeof PremiumFeatures | undefined;
    const selected = feature ? PremiumFeatures[feature] : undefined;
    return this.licensing.getEnforcement(req.user.companyId, selected);
  }
}
