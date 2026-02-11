import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { PluginsModule } from "../plugins/plugins.module";

@Module({
  imports: [PluginsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
