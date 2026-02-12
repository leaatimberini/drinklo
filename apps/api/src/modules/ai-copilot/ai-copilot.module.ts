import { Module } from "@nestjs/common";
import { ImmutableAuditModule } from "../immutable-audit/immutable-audit.module";
import { AiCopilotController } from "./ai-copilot.controller";
import { AiCopilotService } from "./ai-copilot.service";

@Module({
  imports: [ImmutableAuditModule],
  controllers: [AiCopilotController],
  providers: [AiCopilotService],
})
export class AiCopilotModule {}
