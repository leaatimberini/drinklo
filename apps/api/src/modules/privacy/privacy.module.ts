import { Module } from "@nestjs/common";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";
import { PrismaModule } from "../prisma/prisma.module";
import { DataGovernanceModule } from "../data-governance/data-governance.module";

@Module({
  imports: [PrismaModule, DataGovernanceModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
