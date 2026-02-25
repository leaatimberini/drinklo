import { Module } from "@nestjs/common";
import { ImmutableAuditModule } from "../immutable-audit/immutable-audit.module";
import { EdiscoveryController } from "./ediscovery.controller";
import { EdiscoveryService } from "./ediscovery.service";

@Module({
  imports: [ImmutableAuditModule],
  controllers: [EdiscoveryController],
  providers: [EdiscoveryService],
  exports: [EdiscoveryService],
})
export class EdiscoveryModule {}

