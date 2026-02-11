import { Module } from "@nestjs/common";
import { DeliveryRoutingController } from "./delivery-routing.controller";
import { DeliveryRoutingService } from "./delivery-routing.service";
import { GeocodingService } from "../checkout/geocoding.service";

@Module({
  controllers: [DeliveryRoutingController],
  providers: [DeliveryRoutingService, GeocodingService],
})
export class DeliveryRoutingModule {}
