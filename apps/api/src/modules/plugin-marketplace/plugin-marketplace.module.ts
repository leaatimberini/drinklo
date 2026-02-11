import { Module } from "@nestjs/common";
import { PluginMarketplaceController } from "./plugin-marketplace.controller";
import { PluginMarketplaceService } from "./plugin-marketplace.service";

@Module({
  controllers: [PluginMarketplaceController],
  providers: [PluginMarketplaceService],
})
export class PluginMarketplaceModule {}
