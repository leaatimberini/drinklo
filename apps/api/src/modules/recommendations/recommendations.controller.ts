import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RecommendationsService } from "./recommendations.service";
import { RecommendationsQueryDto } from "./dto/recommendations.dto";

@ApiTags("recommendations")
@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  async list(@Query() query: RecommendationsQueryDto) {
    const company = await this.recommendations.getCompany();
    const blocks = (query.blocks ?? "reorder,cross,upsell")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    const cartProductIds = (query.cartProductIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const limit = Math.max(1, Number(query.limit ?? 6));
    const ageVerified = query.ageVerified === "true";
    const optOut = query.optOut === "true";

    return this.recommendations.getRecommendations({
      companyId: company.id,
      blocks,
      limit,
      cartProductIds,
      customerEmail: query.customerEmail ?? null,
      ageVerified,
      optOut,
    });
  }
}
