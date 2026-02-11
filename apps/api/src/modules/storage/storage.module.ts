import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { StorageCleanupService } from "./storage.cleanup";

@Module({
  providers: [StorageService, StorageCleanupService],
  exports: [StorageService],
})
export class StorageModule {}
