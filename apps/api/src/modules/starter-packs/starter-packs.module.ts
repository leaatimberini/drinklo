import { Module } from "@nestjs/common";
import { StarterPacksController } from "./starter-packs.controller";
import { StarterPacksService } from "./starter-packs.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [StarterPacksController],
  providers: [StarterPacksService],
})
export class StarterPacksModule {}
