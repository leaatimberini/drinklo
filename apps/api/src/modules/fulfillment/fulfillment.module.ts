import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { FulfillmentController } from "./fulfillment.controller";
import { FulfillmentService } from "./fulfillment.service";

@Module({
  imports: [PrismaModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
})
export class FulfillmentModule {}
