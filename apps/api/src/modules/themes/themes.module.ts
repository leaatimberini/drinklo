import { Module } from "@nestjs/common";
import { SettingsThemesController } from "./settings-themes.controller";
import { ThemesController } from "./themes.controller";
import { ThemesService } from "./themes.service";

@Module({
  controllers: [ThemesController, SettingsThemesController],
  providers: [ThemesService],
})
export class ThemesModule {}
