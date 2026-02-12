import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { LotsModule } from "../lots/lots.module";

@Module({
  imports: [LotsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
