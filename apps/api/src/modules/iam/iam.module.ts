import { Module } from "@nestjs/common";
import { IamController } from "./iam.controller";
import { IamService } from "./iam.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [IamController],
  providers: [IamService],
  exports: [IamService],
})
export class IamModule {}

