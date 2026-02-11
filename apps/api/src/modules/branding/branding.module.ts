import { Module } from "@nestjs/common";
import { BrandingController } from "./branding.controller";
import { BrandingService } from "./branding.service";
import { SuperAdminGuard } from "./superadmin.guard";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [BrandingController],
  providers: [BrandingService, SuperAdminGuard],
})
export class BrandingModule {}
