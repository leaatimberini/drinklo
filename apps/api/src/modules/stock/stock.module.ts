import { Module } from "@nestjs/common";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";
import { DeveloperApiModule } from "../developer-api/developer-api.module";

@Module({
  imports: [DeveloperApiModule],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
