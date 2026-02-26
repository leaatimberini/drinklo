import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { FraudService } from "./fraud.service";
import { EvaluateOrderFraudDto, FraudQueueQueryDto, ReviewFraudAssessmentDto, UpdateFraudRuleDto } from "./dto/fraud.dto";

@ApiTags("fraud")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/fraud")
export class FraudController {
  constructor(private readonly fraud: FraudService) {}

  @Get("rules")
  @Roles("admin", "manager", "support")
  rules(@Req() req: unknown) {
    return this.fraud.listRules(req.user.companyId);
  }

  @Patch("rules/:code")
  @Roles("admin", "support")
  updateRule(@Req() req: unknown, @Param("code") code: string, @Body() body: UpdateFraudRuleDto) {
    return this.fraud.updateRule(req.user.companyId, code, body);
  }

  @Get("queue")
  @Roles("admin", "manager", "support")
  queue(@Req() req: unknown, @Query() query: FraudQueueQueryDto) {
    return this.fraud.queue(req.user.companyId, query.status ?? "OPEN", query.limit ?? 50);
  }

  @Post("review/:id")
  @Roles("admin", "support")
  review(@Req() req: unknown, @Param("id") id: string, @Body() body: ReviewFraudAssessmentDto) {
    return this.fraud.review(req.user.companyId, id, body.status, req.user.sub, body.note);
  }

  @Post("evaluate/order/:orderId")
  @Roles("admin", "manager", "support")
  evaluateOrder(@Req() req: unknown, @Param("orderId") orderId: string, @Body() body: EvaluateOrderFraudDto) {
    return this.fraud.assessOrder(req.user.companyId, orderId, {
      source: "manual",
      ip: body.ip,
      geoCountry: body.geoCountry,
    });
  }
}
