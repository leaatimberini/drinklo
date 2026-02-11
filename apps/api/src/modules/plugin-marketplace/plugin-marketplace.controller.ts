import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { PluginMarketplaceService } from "./plugin-marketplace.service";
import { PluginRequestDto } from "./dto/plugin-marketplace.dto";

@ApiTags("plugin-marketplace")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/plugins")
export class PluginMarketplaceController {
  constructor(private readonly marketplace: PluginMarketplaceService) {}

  @Post("request")
  @Permissions("settings:write")
  request(@Req() req: any, @Body() body: PluginRequestDto) {
    void req;
    return this.marketplace.requestPlugin(body);
  }
}
