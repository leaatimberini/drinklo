import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { ReconciliationService } from "./reconciliation.service";
import { ReconciliationQueryDto } from "./dto/reconciliation.dto";
import type { Response } from "express";

@ApiTags("reconciliation")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get("report")
  @Permissions("inventory:read")
  report(@Req() req: any, @Query() query: ReconciliationQueryDto) {
    return this.reconciliation.report(req.user.companyId, query.date, query.tz);
  }

  @Get("export")
  @Permissions("inventory:read")
  async export(@Req() req: any, @Query() query: ReconciliationQueryDto, @Res() res: Response) {
    const csv = await this.reconciliation.exportCsv(req.user.companyId, query.date, query.tz);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=reconciliation-${query.date ?? "today"}.csv`);
    res.send(csv);
  }
}
