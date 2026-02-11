import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { StorageModule } from "../storage/storage.module";
import { PluginsModule } from "../plugins/plugins.module";

@Module({
  imports: [StorageModule, PluginsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
