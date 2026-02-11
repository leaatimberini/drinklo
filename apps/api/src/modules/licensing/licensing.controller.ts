import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { SuperAdminGuard } from "../branding/superadmin.guard";
import { LicensingService } from "./licensing.service";
import { LicenseApplyDto, LicenseGenerateDto } from "./dto/license.dto";

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
}
