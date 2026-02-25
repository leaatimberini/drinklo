import { Module } from "@nestjs/common";
import { ImmutableAuditModule } from "../immutable-audit/immutable-audit.module";
import { BotAuditModule } from "../bot-audit/bot-audit.module";
import { SubscriptionLifecycleController } from "./subscription-lifecycle.controller";
import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

@Module({
  imports: [ImmutableAuditModule, BotAuditModule],
  controllers: [SubscriptionLifecycleController],
  providers: [SubscriptionLifecycleService],
  exports: [SubscriptionLifecycleService],
})
export class SubscriptionLifecycleModule {}

