import { Module } from "@nestjs/common";
import { DomainEmailController } from "./domain-email.controller";
import { DomainEmailService } from "./domain-email.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [DomainEmailController],
  providers: [DomainEmailService],
})
export class DomainEmailModule {}
