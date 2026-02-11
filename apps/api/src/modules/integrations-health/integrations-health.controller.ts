import { Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { IntegrationsHealthService } from "./integrations-health.service";

@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/integrations")
export class IntegrationsHealthController {
  constructor(private readonly health: IntegrationsHealthService) {}

  @Get("health")
  @Permissions("settings:write")
  async checkAll(@Req() req: any) {
    const companyId = req.user.companyId;
    const actorId = req.user.sub;
    const results = await Promise.all([
      this.health.checkMercadoPago(companyId, actorId),
      this.health.checkAndreani(companyId, actorId),
    ]);
    return results;
  }

  @Post("health/mercadopago/webhook-test")
  @Permissions("settings:write")
  webhookTest(@Req() req: any) {
    return this.health.testMercadoPagoWebhook(req.user.companyId, req.user.sub);
  }

  @Get("logs")
  @Permissions("settings:write")
  logs(@Req() req: any, @Query("limit") limit?: string) {
    const parsed = Number(limit ?? 50);
    return this.health.getLogs(req.user.companyId, Number.isFinite(parsed) ? parsed : 50);
  }
}
