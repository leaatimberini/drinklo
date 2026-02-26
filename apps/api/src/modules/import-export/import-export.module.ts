import { Module } from "@nestjs/common";
import { ImportExportController } from "./import-export.controller";
import { ImportExportService } from "./import-export.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EdgeCacheModule } from "../edge-cache/edge-cache.module";
import { CatalogModule } from "../catalog/catalog.module";
import { AssistedImportService } from "./assisted-import.service";

@Module({
  imports: [PrismaModule, EdgeCacheModule, CatalogModule],
  controllers: [ImportExportController],
  providers: [ImportExportService, AssistedImportService],
})
export class ImportExportModule {}
