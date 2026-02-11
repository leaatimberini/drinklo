import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { BotAuditService } from "./bot-audit.service";

@ApiTags("bot-audit")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/bot-audit")
export class BotAuditController {
  constructor(private readonly audit: BotAuditService) {}

  @Post()
  @Roles("admin")
  record(@Body() body: any) {
    return this.audit.record(body);
  }
}
