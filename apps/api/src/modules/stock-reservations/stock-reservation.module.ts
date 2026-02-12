import { Module } from "@nestjs/common";
import { StockReservationService } from "./stock-reservation.service";
import { LotsModule } from "../lots/lots.module";

@Module({
  imports: [LotsModule],
  providers: [StockReservationService],
  exports: [StockReservationService],
})
export class StockReservationModule {}
