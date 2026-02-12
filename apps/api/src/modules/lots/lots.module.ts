import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LotsService } from "./lots.service";
import { LotsController } from "./lots.controller";

@Module({
  imports: [PrismaModule],
  providers: [LotsService],
  controllers: [LotsController],
  exports: [LotsService],
})
export class LotsModule {}
