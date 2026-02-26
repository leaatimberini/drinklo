import { Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { WarehouseService } from "./warehouse.service";

@ApiTags("warehouse")
@Controller("admin/bi")
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing", "support")
  @Get("cohorts")
  async cohorts(@Req() req: unknown, @Query("from") from?: string, @Query("to") to?: string) {
    return this.warehouse.getCohorts(req.user.companyId, from, to);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing", "support")
  @Get("retention")
  async retention(@Req() req: unknown, @Query("from") from?: string, @Query("to") to?: string) {
    return this.warehouse.getRetention(req.user.companyId, from, to);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing", "support")
  @Get("ltv")
  async ltv(@Req() req: unknown, @Query("from") from?: string, @Query("to") to?: string) {
    return this.warehouse.getLtv(req.user.companyId, from, to);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "manager", "marketing", "support")
  @Get("rfm")
  async rfm(@Req() req: unknown, @Query("from") from?: string, @Query("to") to?: string) {
    return this.warehouse.getRfm(req.user.companyId, from, to);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "support")
  @Post("etl/run")
  async runEtl() {
    return this.warehouse.runEtl();
  }
}
