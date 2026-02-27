import { Module } from "@nestjs/common";
import { DeveloperApiService } from "./developer-api.service";
import { DeveloperApiAdminController } from "./developer-api-admin.controller";
import { DeveloperApiPublicController } from "./developer-api-public.controller";
import { DeveloperApiKeyGuard } from "./developer-api-key.guard";
import { DeveloperApiUsageInterceptor } from "./developer-api-usage.interceptor";
import { ImmutableAuditModule } from "../immutable-audit/immutable-audit.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule, ImmutableAuditModule],
  controllers: [DeveloperApiAdminController, DeveloperApiPublicController],
  providers: [DeveloperApiService, DeveloperApiKeyGuard, DeveloperApiUsageInterceptor],
  exports: [DeveloperApiService],
})
export class DeveloperApiModule {}
