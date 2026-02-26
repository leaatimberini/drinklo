import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { SecretsService } from "./secrets.service";
import { RotateSecretDto, VerifySecretDto } from "./dto/secret.dto";

@ApiTags("secrets")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/secrets")
export class SecretsController {
  constructor(private readonly secrets: SecretsService) {}

  @Get()
  @Permissions("settings:write")
  list(@Req() req: unknown) {
    return this.secrets.list(req.user.companyId);
  }

  @Post("rotate")
  @Permissions("settings:write")
  rotate(@Req() req: unknown, @Body() body: RotateSecretDto) {
    return this.secrets.rotateSecret({
      companyId: req.user.companyId,
      provider: body.provider,
      payload: body.payload,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      verified: body.verified ?? false,
      actorId: req.user.sub,
    });
  }

  @Post("verify")
  @Permissions("settings:write")
  verify(@Req() req: unknown, @Body() body: VerifySecretDto) {
    return this.secrets.markVerified(req.user.companyId, body.provider, req.user.sub);
  }
}
