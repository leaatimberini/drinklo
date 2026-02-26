import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { PluginsService } from "./plugins.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePluginDto } from "./dto/plugin.dto";

@ApiTags("plugins")
@Controller()
export class PluginsController {
  constructor(
    private readonly plugins: PluginsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("plugins/ui")
  async ui(@Query("slot") slot?: string) {
    const companyId = await this.prisma.company.findFirst().then((c) => c?.id);
    if (!companyId || !slot) return [];
    return this.plugins.getUiSlots(companyId, slot);
  }

  @Get("admin/plugins")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  list(@Req() req: unknown) {
    return this.plugins.listAvailable(req.user.companyId);
  }

  @Post("admin/plugins")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  update(@Req() req: unknown, @Body() body: UpdatePluginDto) {
    return this.plugins.setPlugin(req.user.companyId, {
      name: body.name,
      enabled: body.enabled,
      allowedPermissions: body.allowedPermissions,
    });
  }
}
