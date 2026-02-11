import { Module } from "@nestjs/common";
import { AbTestingService } from "./ab-testing.service";
import { AbTestingController } from "./ab-testing.controller";

@Module({
  providers: [AbTestingService],
  controllers: [AbTestingController],
})
export class AbTestingModule {}
