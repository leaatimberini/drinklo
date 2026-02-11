import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class HealthController {
  @Get("health")
  health() {
    return { ok: true };
  }

  @Get("version")
  version() {
    return {
      commit: process.env.GIT_COMMIT ?? "dev",
      buildDate: process.env.BUILD_DATE ?? new Date().toISOString(),
    };
  }
}
