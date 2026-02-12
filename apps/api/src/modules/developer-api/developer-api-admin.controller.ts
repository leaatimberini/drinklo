import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { generateApiKeyMaterial } from "./developer-api.crypto";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { DeveloperApiService, DEVELOPER_API_SCOPES } from "./developer-api.service";
import {
  CreateDeveloperApiKeyDto,
  CreateDeveloperWebhookDto,
  DeveloperApiUsageQueryDto,
  UpdateDeveloperApiKeyDto,
} from "./dto/developer-api.dto";

@ApiTags("developer-api")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/developer-api")
export class DeveloperApiAdminController {
  constructor(private readonly developerApi: DeveloperApiService) {}

  @Get("scopes")
  @Permissions("settings:write")
  listScopes() {
    return {
      scopes: DEVELOPER_API_SCOPES,
    };
  }

  @Get("keys")
  @Permissions("settings:write")
  listKeys(@Req() req: any) {
    return this.developerApi.listKeys(req.user.companyId);
  }

  @Post("keys")
  @Permissions("settings:write")
  async createKey(@Req() req: any, @Body() body: CreateDeveloperApiKeyDto) {
    const material = generateApiKeyMaterial();
    const created = await this.developerApi.createKey(req.user.companyId, {
      name: body.name,
      scopes: body.scopes,
      rateLimitPerMin: body.rateLimitPerMin,
      createdById: req.user.sub,
      prefix: material.prefix,
      secret: material.secret,
    });

    return {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      rateLimitPerMin: created.rateLimitPerMin,
      createdAt: created.createdAt,
      key: material.fullKey,
      warning: "Store this key now. It will not be shown again.",
    };
  }

  @Patch("keys/:id")
  @Permissions("settings:write")
  updateKey(@Req() req: any, @Param("id") id: string, @Body() body: UpdateDeveloperApiKeyDto) {
    return this.developerApi.updateKey(req.user.companyId, id, body, req.user.sub);
  }

  @Post("keys/:id/revoke")
  @Permissions("settings:write")
  revokeKey(@Req() req: any, @Param("id") id: string) {
    return this.developerApi.revokeKey(req.user.companyId, id, req.user.sub);
  }

  @Get("usage")
  @Permissions("settings:write")
  usage(@Req() req: any, @Query() query: DeveloperApiUsageQueryDto) {
    return this.developerApi.usage(req.user.companyId, query.from, query.to);
  }

  @Get("webhooks")
  @Permissions("settings:write")
  listWebhooks(@Req() req: any) {
    return this.developerApi.listWebhooks(req.user.companyId);
  }

  @Post("webhooks")
  @Permissions("settings:write")
  createWebhook(@Req() req: any, @Body() body: CreateDeveloperWebhookDto) {
    return this.developerApi.createWebhook(req.user.companyId, body);
  }

  @Post("webhooks/:id/revoke")
  @Permissions("settings:write")
  revokeWebhook(@Req() req: any, @Param("id") id: string) {
    return this.developerApi.revokeWebhook(req.user.companyId, id);
  }
}
