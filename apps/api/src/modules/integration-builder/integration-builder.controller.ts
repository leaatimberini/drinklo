import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import {
  ConnectorSecretRotateDto,
  DeliveryLogsQueryDto,
  IntegrationBuilderPreviewDto,
  UpsertIntegrationConnectorsDto,
} from "./dto/integration-builder.dto";
import { IntegrationBuilderService } from "./integration-builder.service";

@ApiTags("integration-builder")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/integration-builder")
export class IntegrationBuilderController {
  constructor(private readonly builder: IntegrationBuilderService) {}

  @Get("connectors")
  @Permissions("settings:write")
  list(@Req() req: any) {
    return this.builder.listConnectors(req.user.companyId);
  }

  @Put("connectors")
  @Permissions("settings:write")
  upsert(@Req() req: any, @Body() body: UpsertIntegrationConnectorsDto) {
    return this.builder.upsertConnectors(req.user.companyId, body);
  }

  @Delete("connectors/:id")
  @Permissions("settings:write")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.builder.deleteConnector(req.user.companyId, id);
  }

  @Post("preview")
  @Permissions("settings:write")
  preview(@Req() req: any, @Body() body: IntegrationBuilderPreviewDto) {
    return this.builder.preview(req.user.companyId, body);
  }

  @Post("connectors/:id/secret")
  @Permissions("settings:write")
  rotateSecret(@Req() req: any, @Param("id") id: string, @Body() body: ConnectorSecretRotateDto) {
    return this.builder.rotateConnectorSecret(req.user.companyId, id, body, req.user.sub);
  }

  @Get("connectors/:id/logs")
  @Permissions("settings:write")
  logs(@Req() req: any, @Param("id") id: string, @Query() query: DeliveryLogsQueryDto) {
    return this.builder.listDeliveryLogs(req.user.companyId, id, query);
  }

  @Get("connectors/:id/metrics")
  @Permissions("settings:write")
  metrics(@Req() req: any, @Param("id") id: string) {
    return this.builder.getConnectorMetrics(req.user.companyId, id);
  }

  @Get("metrics")
  @Permissions("settings:write")
  allMetrics(@Req() req: any) {
    return this.builder.listAllConnectorMetrics(req.user.companyId);
  }

  @Post("connectors/:id/retry-dlq")
  @Permissions("settings:write")
  retryDlq(@Req() req: any, @Param("id") id: string) {
    return this.builder.retryDlq(req.user.companyId, id);
  }

  @Post("report-control-plane")
  @Permissions("settings:write")
  async reportControlPlane(@Req() req: any) {
    await this.builder.reportSummaryToControlPlane(req.user.companyId);
    return { ok: true };
  }
}

