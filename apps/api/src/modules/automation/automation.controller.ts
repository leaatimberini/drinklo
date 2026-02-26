import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { AutomationService } from "./automation.service";
import {
  CreateActionDto,
  CreateCampaignDto,
  CreateFlowDto,
  CreateSegmentDto,
  CreateSuppressionDto,
  CreateTriggerDto,
  RecordMetricDto,
  RunFlowDto,
  UpdateActionDto,
  UpdateFlowDto,
  UpdateTriggerDto,
} from "./dto/automation.dto";

@ApiTags("automation")
@ApiBearerAuth()
@Controller("admin/automation")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles("admin", "manager", "marketing")
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get("segments")
  listSegments(@Req() req: unknown) {
    return this.automation.listSegments(req.user.companyId);
  }

  @Post("segments")
  createSegment(@Req() req: unknown, @Body() body: CreateSegmentDto) {
    return this.automation.createSegment(req.user.companyId, body);
  }

  @Get("campaigns")
  listCampaigns(@Req() req: unknown) {
    return this.automation.listCampaigns(req.user.companyId);
  }

  @Post("campaigns")
  createCampaign(@Req() req: unknown, @Body() body: CreateCampaignDto) {
    return this.automation.createCampaign(req.user.companyId, body);
  }

  @Get("triggers")
  listTriggers(@Req() req: unknown) {
    return this.automation.listTriggers(req.user.companyId);
  }

  @Post("triggers")
  createTrigger(@Req() req: unknown, @Body() body: CreateTriggerDto) {
    return this.automation.createTrigger(req.user.companyId, body);
  }

  @Patch("triggers/:id")
  updateTrigger(@Req() req: unknown, @Param("id") id: string, @Body() body: UpdateTriggerDto) {
    return this.automation.updateTrigger(req.user.companyId, id, body);
  }

  @Get("flows")
  listFlows(@Req() req: unknown) {
    return this.automation.listFlows(req.user.companyId);
  }

  @Get("flows/:id")
  getFlow(@Req() req: unknown, @Param("id") id: string) {
    return this.automation.getFlow(req.user.companyId, id);
  }

  @Post("flows")
  createFlow(@Req() req: unknown, @Body() body: CreateFlowDto) {
    return this.automation.createFlow(req.user.companyId, body);
  }

  @Patch("flows/:id")
  updateFlow(@Req() req: unknown, @Param("id") id: string, @Body() body: UpdateFlowDto) {
    return this.automation.updateFlow(req.user.companyId, id, body);
  }

  @Post("flows/:id/actions")
  addAction(@Req() req: unknown, @Param("id") id: string, @Body() body: CreateActionDto) {
    return this.automation.addAction(req.user.companyId, id, body);
  }

  @Patch("actions/:id")
  updateAction(@Req() req: unknown, @Param("id") id: string, @Body() body: UpdateActionDto) {
    return this.automation.updateAction(req.user.companyId, id, body);
  }

  @Post("actions/:id/delete")
  removeAction(@Req() req: unknown, @Param("id") id: string) {
    return this.automation.removeAction(req.user.companyId, id);
  }

  @Get("suppressions")
  listSuppressions(@Req() req: unknown) {
    return this.automation.listSuppressions(req.user.companyId);
  }

  @Post("suppressions")
  createSuppression(@Req() req: unknown, @Body() body: CreateSuppressionDto) {
    return this.automation.createSuppression(req.user.companyId, body);
  }

  @Post("flows/:id/test-run")
  testRun(@Req() req: unknown, @Param("id") id: string, @Body() body: RunFlowDto) {
    return this.automation.runFlowTest(req.user.companyId, id, body);
  }

  @Get("flows/:id/metrics")
  metrics(@Req() req: unknown, @Param("id") id: string, @Query("from") from?: string, @Query("to") to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.automation.getMetrics(req.user.companyId, id, fromDate, toDate);
  }

  @Post("flows/:id/metrics")
  recordMetric(@Req() req: unknown, @Param("id") id: string, @Body() body: RecordMetricDto) {
    const date = body.date ? new Date(body.date) : undefined;
    return this.automation.recordMetric(req.user.companyId, id, body.type, date);
  }
}
