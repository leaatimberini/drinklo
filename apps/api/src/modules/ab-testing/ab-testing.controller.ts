import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { AbTestingService } from "./ab-testing.service";
import { CreateExperimentDto, CreateVariantDto, RecordExperimentEventDto } from "./dto/ab.dto";
import type { Response } from "express";
import { ExperimentTarget } from "@erp/db";

@ApiTags("ab-testing")
@Controller()
export class AbTestingController {
  constructor(private readonly ab: AbTestingService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing")
  @Get("admin/experiments")
  list(@Req() req: unknown) {
    return this.ab.listExperiments(req.user.companyId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing")
  @Post("admin/experiments")
  create(@Req() req: unknown, @Body() body: CreateExperimentDto) {
    return this.ab.createExperiment(req.user.companyId, body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing")
  @Post("admin/experiments/:id/variants")
  createVariant(@Req() req: unknown, @Param("id") id: string, @Body() body: CreateVariantDto) {
    return this.ab.createVariant(req.user.companyId, id, body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing")
  @Get("admin/experiments/:id/report")
  report(@Req() req: unknown, @Param("id") id: string) {
    return this.ab.report(req.user.companyId, id);
  }

  @Get("experiments/assign")
  async assign(
    @Req() req: unknown,
    @Res({ passthrough: true }) res: Response,
    @Query("target") target: ExperimentTarget,
    @Query("userId") userId?: string,
  ) {
    if (!target) return { ok: false, reason: "target_required" };
    const enabled = await this.ab.isEnabled();
    if (!enabled) return { ok: false, reason: "disabled" };
    const cookie = req.cookies?.erp_ab ?? "";
    const companyId = await this.ab.getCompanyId();
    const result = await this.ab.assign(companyId, target, cookie, userId);
    if (result.ok) {
      res.cookie("erp_ab", JSON.stringify(result.cookie), { httpOnly: true, sameSite: "lax" });
    }
    return result;
  }

  @Post("experiments/event")
  async recordEvent(@Req() req: unknown, @Body() body: RecordExperimentEventDto) {
    const enabled = await this.ab.isEnabled();
    if (!enabled) return { ok: false, reason: "disabled" };
    const companyId = await this.ab.getCompanyId();
    const target = body.target as ExperimentTarget;
    if (!target) return { ok: false, reason: "target_required" };
    const assignment = await this.ab.resolveAssignment(companyId, target, req.cookies?.erp_ab ?? "");
    if (!assignment) return { ok: false, reason: "no_assignment" };
    await this.ab.recordEvent(companyId, assignment, body.type, body.orderId);
    return { ok: true };
  }
}
