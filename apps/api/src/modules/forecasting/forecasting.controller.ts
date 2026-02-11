import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { ForecastQueryDto } from "./dto/forecasting.dto";
import { ForecastingService } from "./forecasting.service";

@ApiTags("forecasting")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/forecasting")
export class ForecastingController {
  constructor(private readonly forecasting: ForecastingService) {}

  @Get()
  @Roles("admin", "manager")
  async list(@Req() req: any, @Query() query: ForecastQueryDto) {
    const horizon = Number(query.horizonDays ?? "14");
    return this.forecasting.forecast(req.user.companyId, horizon);
  }
}
