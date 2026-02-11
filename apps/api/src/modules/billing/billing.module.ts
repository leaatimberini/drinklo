import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { SharedModule } from "../shared/shared.module";
import { StorageModule } from "../storage/storage.module";
import { LicensingModule } from "../licensing/licensing.module";
import { SecretsModule } from "../secrets/secrets.module";

@Module({
  imports: [SharedModule, StorageModule, LicensingModule, SecretsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
