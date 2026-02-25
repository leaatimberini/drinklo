import { Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import type { Response } from "express";
import { EdiscoveryService } from "./ediscovery.service";
import { EdiscoveryExportDto, EdiscoveryVerifyDto } from "./dto/ediscovery.dto";

@ApiTags("ediscovery")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/ediscovery")
export class EdiscoveryController {
  constructor(private readonly ediscovery: EdiscoveryService) {}

  @Post("export")
  @Permissions("settings:write")
  async exportPack(@Req() req: any, @Body() body: EdiscoveryExportDto, @Res() res: Response) {
    const pack = await this.ediscovery.exportForensicPack(req.user.companyId, body);
    const file = `ediscovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=${file}`);
    res.send(JSON.stringify(pack, null, 2));
  }

  @Post("verify")
  @Permissions("settings:write")
  verifyPack(@Body() body: EdiscoveryVerifyDto) {
    return this.ediscovery.verifyForensicPack(body?.pack ?? body);
  }
}

