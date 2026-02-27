import { Module } from "@nestjs/common";
import { SetupController } from "./setup.controller";
import { InstanceController } from "./instance.controller";
import { InstallerController } from "./installer.controller";
import { SetupService } from "./setup.service";

@Module({
  controllers: [SetupController, InstanceController, InstallerController],
  providers: [SetupService],
})
export class SetupModule {}
