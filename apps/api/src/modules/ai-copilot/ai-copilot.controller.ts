import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { AiCopilotService } from "./ai-copilot.service";
import { CopilotApproveDto, CopilotChatDto } from "./dto/copilot.dto";

@ApiTags("ai-copilot")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/copilot")
export class AiCopilotController {
  constructor(private readonly copilot: AiCopilotService) {}

  @Post("chat")
  @Permissions("products:read")
  chat(@Req() req: any, @Body() body: CopilotChatDto) {
    return this.copilot.chat(req.user, body.prompt, body.mode ?? "admin");
  }

  @Get("proposals")
  @Permissions("products:read")
  list(@Req() req: any, @Query("status") status?: string) {
    return this.copilot.listProposals(req.user.companyId, status ?? "PENDING");
  }

  @Post("proposals/:id/approve")
  @Permissions("products:read")
  approve(@Req() req: any, @Param("id") id: string, @Body() body: CopilotApproveDto) {
    return this.copilot.approveProposal(req.user, id, body.note);
  }
}
