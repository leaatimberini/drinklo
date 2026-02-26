import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { DomainEmailService } from "./domain-email.service";
import { EmailEventDto, UpsertEmailDomainDto, VerifyEmailDomainDto } from "./dto/domain-email.dto";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("email-domain")
@Controller()
export class DomainEmailController {
  constructor(
    private readonly service: DomainEmailService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("admin/email-domain")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  get(@Req() req: unknown) {
    return this.service.get(req.user.companyId);
  }

  @Patch("admin/email-domain")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  upsert(@Req() req: unknown, @Body() body: UpsertEmailDomainDto) {
    return this.service.upsert(req.user.companyId, body);
  }

  @Post("admin/email-domain/confirm")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  confirm(@Req() req: unknown, @Body() body: VerifyEmailDomainDto) {
    return this.service.confirm(req.user.companyId, body.confirmed !== false, req.user.sub);
  }

  @Post("webhooks/email")
  async webhook(@Req() req: unknown, @Body() body: EmailEventDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      return { ok: true };
    }
    await this.service.recordEvent(company.id, body, req.body);
    return { ok: true };
  }
}
