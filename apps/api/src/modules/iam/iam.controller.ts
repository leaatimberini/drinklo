import { Body, Controller, Get, Headers, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { IamService } from "./iam.service";
import { SsoMockLoginDto, TestIamConnectionDto, UpdateIamConfigDto, VerifyMfaDto } from "./dto/iam.dto";
import { AuthService } from "../auth/auth.service";

@ApiTags("iam")
@Controller()
export class IamController {
  constructor(
    private readonly iam: IamService,
    private readonly auth: AuthService,
  ) {}

  @Get("admin/iam/config")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "support")
  async getConfig(@Req() req: any) {
    const cfg = await this.iam.getConfig(req.user.companyId);
    return this.iam.summarizeStatus(cfg);
  }

  @Patch("admin/iam/config")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  async updateConfig(@Req() req: any, @Body() body: UpdateIamConfigDto) {
    const cfg = await this.iam.updateConfig(req.user.companyId, body);
    return this.iam.summarizeStatus(cfg);
  }

  @Post("admin/iam/test-connection")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  testConnection(@Req() req: any, @Body() body: TestIamConnectionDto) {
    return this.iam.testConnection(req.user.companyId, body.protocol);
  }

  @Post("admin/iam/mfa/setup")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "support")
  setupMfa(@Req() req: any) {
    return this.iam.setupMfa(req.user.sub, req.user.email ?? "user@example.local");
  }

  @Post("admin/iam/mfa/verify")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "support")
  verifyMfa(@Req() req: any, @Body() body: VerifyMfaDto) {
    return this.iam.verifyMfa(req.user.sub, body.code);
  }

  @Post("auth/sso/login")
  async ssoLogin(@Body() body: SsoMockLoginDto) {
    const user = await this.iam.authenticateSsoMock(body.protocol, body.token, body.companyId);
    return this.auth.issueTokenForUser(user as any);
  }

  @Post("scim/v2/Users")
  async scimCreate(@Headers("authorization") authorization: string | undefined, @Body() body: any) {
    const token = String(authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    const user = await this.iam.scimCreateUserByToken(token, body);
    return {
      id: user.id,
      userName: user.email,
      displayName: user.name,
      active: true,
    };
  }

  @Patch("scim/v2/Users/:id")
  async scimPatch(@Headers("authorization") authorization: string | undefined, @Req() req: any, @Body() body: any) {
    const token = String(authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    const operations = body?.Operations ?? [];
    const isDisable = operations.some((op: any) => op?.path === "active" && op?.value === false);
    if (!isDisable) {
      return { ok: true, ignored: true };
    }
    await this.iam.scimDisableUserByToken(token, req.params.id, body);
    return { ok: true };
  }

  @Get("admin/iam/status")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "support")
  async status(@Req() req: any) {
    const cfg = await this.iam.getConfig(req.user.companyId);
    return this.iam.summarizeStatus(cfg);
  }
}
