import { Module } from "@nestjs/common";
import { LicensingController } from "./licensing.controller";
import { LicensingService } from "./licensing.service";
import { SuperAdminGuard } from "../branding/superadmin.guard";

@Module({
  controllers: [LicensingController],
  providers: [LicensingService, SuperAdminGuard],
  exports: [LicensingService],
})
export class LicensingModule {}
