import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MercadoPagoController } from "./mercadopago.controller";
import { MercadoPagoWebhookController } from "./mercadopago.webhook.controller";
import { PaymentsService } from "./payments.service";
import { StockReservationModule } from "../stock-reservations/stock-reservation.module";
import { SecretsModule } from "../secrets/secrets.module";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [StockReservationModule, SecretsModule, MetricsModule],
  controllers: [MercadoPagoController, MercadoPagoWebhookController],
  providers: [PaymentsService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
