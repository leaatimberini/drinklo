import { Module } from "@nestjs/common";
import { IntegrationsHealthController } from "./integrations-health.controller";
import { IntegrationsHealthService } from "./integrations-health.service";

@Module({
  controllers: [IntegrationsHealthController],
  providers: [IntegrationsHealthService],
})
export class IntegrationsHealthModule {}
