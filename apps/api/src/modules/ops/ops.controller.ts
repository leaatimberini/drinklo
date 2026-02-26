import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { OpsService } from "./ops.service";
import type { Response } from "express";

type AdminOpsRequest = {
  user?: {
    companyId?: string | null;
  };
};

@ApiTags("ops")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/ops")
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get()
  @Roles("admin")
  async snapshot(@Req() req: AdminOpsRequest) {
    return this.ops.getSnapshot(req.user?.companyId);
  }

  @Get("diagnostic")
  @Roles("admin")
  async diagnostic(@Req() req: AdminOpsRequest, @Query("limit") limit: string, @Res() res: Response) {
    const parsed = Number(limit ?? 50);
    const bundle = await this.ops.getDiagnosticBundle(
      Number.isFinite(parsed) ? parsed : 50,
      req.user?.companyId,
    );
    const payload = JSON.stringify(bundle, null, 2);
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    res.send(payload);
  }
}
