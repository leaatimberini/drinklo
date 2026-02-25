import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MercadoPagoController } from "./mercadopago.controller";
import { MercadoPagoWebhookController } from "./mercadopago.webhook.controller";
import { MercadoPagoBillingSubscriptionsController } from "./mercadopago-billing-subscriptions.controller";
import { PaymentsService } from "./payments.service";
import { MercadoPagoBillingSubscriptionsService } from "./mercadopago-billing-subscriptions.service";
import { StockReservationModule } from "../stock-reservations/stock-reservation.module";
import { SecretsModule } from "../secrets/secrets.module";
import { MetricsModule } from "../metrics/metrics.module";
import { FraudModule } from "../fraud/fraud.module";
import { DeveloperApiModule } from "../developer-api/developer-api.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { PlansModule } from "../plans/plans.module";
import { ImmutableAuditModule } from "../immutable-audit/immutable-audit.module";

@Module({
  imports: [
    StockReservationModule,
    SecretsModule,
    MetricsModule,
    FraudModule,
    DeveloperApiModule,
    SandboxModule,
    PlansModule,
    ImmutableAuditModule,
  ],
  controllers: [MercadoPagoController, MercadoPagoWebhookController, MercadoPagoBillingSubscriptionsController],
  providers: [PaymentsService, MercadoPagoBillingSubscriptionsService, PrismaService],
  exports: [PaymentsService, MercadoPagoBillingSubscriptionsService],
})
export class PaymentsModule {}
