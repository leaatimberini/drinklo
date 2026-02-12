import { Module } from "@nestjs/common";
import { SandboxService } from "./sandbox.service";
import { SandboxController } from "./sandbox.controller";
import { StockReservationModule } from "../stock-reservations/stock-reservation.module";

@Module({
  imports: [StockReservationModule],
  providers: [SandboxService],
  controllers: [SandboxController],
  exports: [SandboxService],
})
export class SandboxModule {}
