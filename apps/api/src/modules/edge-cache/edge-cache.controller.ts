import { Body, Controller, Ip, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { EdgeCacheService } from "./edge-cache.service";
import { WebVitalDto } from "./dto/web-vital.dto";

@ApiTags("edge-cache")
@Controller("public/edge")
export class EdgeCacheController {
  constructor(private readonly edgeCache: EdgeCacheService) {}

  @Post("vitals")
  async reportVitals(@Body() body: WebVitalDto, @Req() req: any, @Ip() ip: string) {
    await this.edgeCache.reportWebVital({
      name: body.name,
      value: body.value,
      rating: body.rating,
      path: body.path,
      id: body.id,
      capturedAt: new Date().toISOString(),
      userAgent: req.headers?.["user-agent"] as string | undefined,
      ip,
    });
    return { ok: true };
  }
}
