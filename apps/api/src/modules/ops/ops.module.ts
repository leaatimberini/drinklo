import { Module } from "@nestjs/common";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";
import { SecretsModule } from "../secrets/secrets.module";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [SecretsModule, MetricsModule],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}
