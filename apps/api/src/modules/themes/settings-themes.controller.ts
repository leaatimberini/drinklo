import { Body, Controller, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { UpdateThemeDto } from "./dto/update-theme.dto";
import { ThemesService } from "./themes.service";

@ApiTags("settings")
@Controller("settings")
export class SettingsThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Put("themes")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  updateThemes(@Body() body: UpdateThemeDto) {
    return this.themes.updateThemes(body);
  }
}
