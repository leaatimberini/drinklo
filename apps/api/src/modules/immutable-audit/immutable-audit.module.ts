import { Module } from "@nestjs/common";
import { ImmutableAuditService } from "./immutable-audit.service";
import { ImmutableAuditController } from "./immutable-audit.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [ImmutableAuditService],
  controllers: [ImmutableAuditController],
  exports: [ImmutableAuditService],
})
export class ImmutableAuditModule {}
