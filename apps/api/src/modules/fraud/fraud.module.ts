import { Module } from "@nestjs/common";
import { FraudService } from "./fraud.service";
import { FraudController } from "./fraud.controller";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  providers: [FraudService],
  controllers: [FraudController],
  exports: [FraudService],
})
export class FraudModule {}
