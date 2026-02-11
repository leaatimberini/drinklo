import { Module } from "@nestjs/common";
import { BotAuditService } from "./bot-audit.service";
import { BotAuditController } from "./bot-audit.controller";

@Module({
  controllers: [BotAuditController],
  providers: [BotAuditService],
  exports: [BotAuditService],
})
export class BotAuditModule {}
