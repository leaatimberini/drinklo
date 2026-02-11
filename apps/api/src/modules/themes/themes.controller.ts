import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { UpdateThemeDto } from "./dto/update-theme.dto";
import { ThemesService } from "./themes.service";

@ApiTags("themes")
@Controller("themes")
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get("public")
  getPublic() {
    return this.themes.getActive();
  }

  @Patch()
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  update(@Body() body: UpdateThemeDto) {
    return this.themes.updateThemes(body);
  }
}
