import { Module } from "@nestjs/common";
import { TaxesAdminController } from "./taxes.controller";
import { TaxesService } from "./taxes.service";

@Module({
  controllers: [TaxesAdminController],
  providers: [TaxesService],
  exports: [TaxesService],
})
export class TaxesModule {}

