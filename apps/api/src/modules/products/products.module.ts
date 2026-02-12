import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { StorageModule } from "../storage/storage.module";
import { PluginsModule } from "../plugins/plugins.module";
import { CatalogModule } from "../catalog/catalog.module";
import { EdgeCacheModule } from "../edge-cache/edge-cache.module";

@Module({
  imports: [StorageModule, PluginsModule, CatalogModule, EdgeCacheModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
