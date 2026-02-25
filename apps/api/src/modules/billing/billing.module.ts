import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingSupportController } from "./billing-support.controller";
import { BillingService } from "./billing.service";
import { BillingPlanChangesService } from "./billing-plan-changes.service";
import { SharedModule } from "../shared/shared.module";
import { StorageModule } from "../storage/storage.module";
import { LicensingModule } from "../licensing/licensing.module";
import { SecretsModule } from "../secrets/secrets.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { PlansModule } from "../plans/plans.module";
import { ImmutableAuditModule } from "../immutable-audit/immutable-audit.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [SharedModule, StorageModule, LicensingModule, SecretsModule, SandboxModule, PlansModule, ImmutableAuditModule, PaymentsModule],
  controllers: [BillingController, BillingSupportController],
  providers: [BillingService, BillingPlanChangesService],
  exports: [BillingPlanChangesService],
})
export class BillingModule {}
