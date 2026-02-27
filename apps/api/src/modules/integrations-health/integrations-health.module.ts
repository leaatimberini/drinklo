import { Module } from "@nestjs/common";
import { IntegrationsHealthController } from "./integrations-health.controller";
import { IntegrationsHealthService } from "./integrations-health.service";
import { PrismaModule } from "../prisma/prisma.module";
import { SecretsModule } from "../secrets/secrets.module";

@Module({
  imports: [PrismaModule, SecretsModule],
  controllers: [IntegrationsHealthController],
  providers: [IntegrationsHealthService],
})
export class IntegrationsHealthModule {}
