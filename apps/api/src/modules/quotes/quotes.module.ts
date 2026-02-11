import { Module } from "@nestjs/common";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { SalesModule } from "../sales/sales.module";
import { SharedModule } from "../shared/shared.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [SharedModule, SalesModule, StorageModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
