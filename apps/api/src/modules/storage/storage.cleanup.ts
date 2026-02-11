import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { StorageService } from "./storage.service";

@Injectable()
export class StorageCleanupService {
  private readonly logger = new Logger(StorageCleanupService.name);

  constructor(private readonly storage: StorageService) {}

  @Cron("0 3 * * *")
  async cleanupOldPdfs() {
    const retentionDays = Number(process.env.STORAGE_RETENTION_DAYS ?? 30);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const objects = await this.storage.list("pdfs/");
    const targets = objects.filter((item) => (item.lastModified?.getTime() ?? 0) < cutoff);

    if (targets.length === 0) {
      return;
    }

    for (const item of targets) {
      try {
        await this.storage.delete(item.key);
      } catch (error: any) {
        this.logger.warn(`Failed to delete ${item.key}: ${error?.message ?? String(error)}`);
      }
    }

    this.logger.log(`Storage cleanup deleted ${targets.length} old pdfs`);
  }
}
