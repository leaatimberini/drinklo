import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { DataGovernanceService } from "./data-governance.service";
import {
  CreateLegalHoldDto,
  GovernanceRunsQueryDto,
  ReleaseLegalHoldDto,
  UpsertRetentionPoliciesDto,
} from "./dto/governance.dto";

@ApiTags("data-governance")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/governance")
export class DataGovernanceController {
  constructor(private readonly governance: DataGovernanceService) {}

  @Get("policies/effective")
  @Roles("admin", "manager", "support")
  effectivePolicies(@Req() req: unknown) {
    return this.governance.getEffectivePolicies(req.user.companyId);
  }

  @Get("policies")
  @Roles("admin", "manager", "support")
  listPolicies(@Req() req: unknown) {
    return this.governance.listPolicies(req.user.companyId);
  }

  @Put("policies")
  @Roles("admin", "support")
  upsertPolicies(@Req() req: unknown, @Body() body: UpsertRetentionPoliciesDto) {
    return this.governance.upsertPolicies(req.user.companyId, body, req.user.sub);
  }

  @Post("legal-holds")
  @Roles("admin", "support")
  createLegalHold(@Req() req: unknown, @Body() body: CreateLegalHoldDto) {
    return this.governance.createLegalHold(req.user.companyId, body, req.user.sub);
  }

  @Get("legal-holds")
  @Roles("admin", "manager", "support")
  listLegalHolds(@Req() req: unknown) {
    return this.governance.listLegalHolds(req.user.companyId);
  }

  @Post("legal-holds/:id/release")
  @Roles("admin", "support")
  releaseLegalHold(@Req() req: unknown, @Param("id") id: string, @Body() body: ReleaseLegalHoldDto) {
    return this.governance.releaseLegalHold(req.user.companyId, id, body, req.user.sub);
  }

  @Post("purge/run")
  @Roles("admin", "support")
  runPurge(@Req() req: unknown) {
    return this.governance.runPurge(req.user.companyId, req.user.sub, "manual");
  }

  @Get("purge/runs")
  @Roles("admin", "manager", "support")
  runs(@Req() req: unknown, @Query() query: GovernanceRunsQueryDto) {
    return this.governance.listRuns(req.user.companyId, query.limit ?? 20);
  }
}
