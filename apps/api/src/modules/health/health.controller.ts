import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health() {
    return { ok: true, readReplicas: this.prisma.getReadReplicaStatus() };
  }

  @Get("version")
  version() {
    return {
      commit: process.env.GIT_COMMIT ?? "dev",
      buildDate: process.env.BUILD_DATE ?? new Date().toISOString(),
    };
  }

  @Get("health/regions")
  regions() {
    return this.prisma.getReadReplicaStatus();
  }
}
