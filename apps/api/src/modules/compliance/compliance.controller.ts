import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { ComplianceService } from "./compliance.service";
import { ConsentDto, UpdateComplianceDto } from "./dto/compliance.dto";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("compliance")
@Controller()
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("compliance/public")
  publicSettings() {
    return this.compliance.getPublicSettings();
  }

  @Post("compliance/consent")
  async consent(@Req() req: unknown, @Body() body: ConsentDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      return { ok: true };
    }
    await this.compliance.recordConsent(
      company.id,
      body,
      req.ip,
      req.user?.sub,
    );
    return { ok: true };
  }

  @Get("admin/compliance")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  adminSettings(@Req() req: unknown) {
    return this.compliance.getAdminSettings(req.user.companyId);
  }

  @Patch("admin/compliance")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  update(@Req() req: unknown, @Body() body: UpdateComplianceDto) {
    return this.compliance.updateAdminSettings(req.user.companyId, body);
  }
}
