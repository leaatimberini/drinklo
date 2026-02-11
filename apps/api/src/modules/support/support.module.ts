import { Module } from "@nestjs/common";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";
import { OpsModule } from "../ops/ops.module";

@Module({
  imports: [OpsModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
