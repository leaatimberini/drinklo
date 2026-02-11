import { Module } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { ShippingService } from "./shipping.service";
import { GeocodingService } from "./geocoding.service";
import { SharedModule } from "../shared/shared.module";
import { StorageModule } from "../storage/storage.module";
import { LicensingModule } from "../licensing/licensing.module";
import { SecretsModule } from "../secrets/secrets.module";
import { PluginsModule } from "../plugins/plugins.module";
import { EventsModule } from "../events/events.module";
import { PromosModule } from "../promos/promos.module";

@Module({
  imports: [SharedModule, StorageModule, LicensingModule, SecretsModule, PluginsModule, EventsModule, PromosModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, ShippingService, GeocodingService],
})
export class CheckoutModule {}
