import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import type { Response } from "express";
import { ImmutableAuditService } from "./immutable-audit.service";
import { AuditQueryDto } from "./dto/audit.dto";

@ApiTags("immutable-audit")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/audit")
export class ImmutableAuditController {
  constructor(private readonly audit: ImmutableAuditService) {}

  @Get()
  @Roles("admin", "support")
  list(@Req() req: any, @Query() query: AuditQueryDto) {
    return this.audit.list(req.user.companyId, query);
  }

  @Get("verify")
  @Roles("admin", "support")
  verify(@Req() req: any, @Query() query: AuditQueryDto) {
    return this.audit.verify(req.user.companyId, query);
  }

  @Get("evidence-pack")
  @Roles("admin", "support")
  async evidencePack(@Req() req: any, @Res() res: Response, @Query() query: AuditQueryDto) {
    const pack = await this.audit.exportEvidencePack(req.user.companyId, query);
    const file = `evidence-pack-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=${file}`);
    res.send(JSON.stringify(pack, null, 2));
  }
}
