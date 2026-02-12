import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EdgeCacheService } from "./edge-cache.service";
import { EdgeCacheController } from "./edge-cache.controller";

@Module({
  imports: [ConfigModule],
  providers: [EdgeCacheService],
  controllers: [EdgeCacheController],
  exports: [EdgeCacheService],
})
export class EdgeCacheModule {}
