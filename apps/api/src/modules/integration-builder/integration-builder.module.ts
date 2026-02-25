import { Module } from "@nestjs/common";
import { SecretsModule } from "../secrets/secrets.module";
import { IntegrationBuilderController } from "./integration-builder.controller";
import { IntegrationBuilderService } from "./integration-builder.service";

@Module({
  imports: [SecretsModule],
  controllers: [IntegrationBuilderController],
  providers: [IntegrationBuilderService],
  exports: [IntegrationBuilderService],
})
export class IntegrationBuilderModule {}

