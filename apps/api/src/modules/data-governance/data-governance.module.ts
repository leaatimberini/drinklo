import { Module } from "@nestjs/common";
import { DataGovernanceService } from "./data-governance.service";
import { DataGovernanceController } from "./data-governance.controller";
import { DataGovernanceJob } from "./data-governance.job";

@Module({
  providers: [DataGovernanceService, DataGovernanceJob],
  controllers: [DataGovernanceController],
  exports: [DataGovernanceService],
})
export class DataGovernanceModule {}
