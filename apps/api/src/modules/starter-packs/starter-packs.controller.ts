import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { StarterPacksService } from "./starter-packs.service";
import { ApplyStarterPackDto } from "./dto/starter-pack.dto";

@ApiTags("starter-packs")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/starter-packs")
export class StarterPacksController {
  constructor(private readonly starter: StarterPacksService) {}

  @Post("apply")
  @Permissions("settings:write")
  async apply(@Req() req: unknown, @Body() body: ApplyStarterPackDto) {
    const catalog = body.catalog ?? true;
    const templates = body.templates ?? true;
    const packageId = body.packageId;

    if (catalog) {
      await this.starter.applyCatalog(req.user.companyId);
    }
    if (templates) {
      await this.starter.applyTemplates(req.user.companyId);
    }
    if (packageId) {
      await this.starter.applyPackage(req.user.companyId, packageId);
    }

    return { ok: true, catalog, templates, packageId };
  }

  @Get("packages")
  @Permissions("settings:write")
  packages() {
    return this.starter.getPackages();
  }
}
