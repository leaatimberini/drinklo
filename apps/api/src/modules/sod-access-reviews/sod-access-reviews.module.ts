import { Module } from "@nestjs/common";
import { SodAccessReviewsController } from "./sod-access-reviews.controller";
import { SodAccessReviewsService } from "./sod-access-reviews.service";

@Module({
  controllers: [SodAccessReviewsController],
  providers: [SodAccessReviewsService],
  exports: [SodAccessReviewsService],
})
export class SodAccessReviewsModule {}
