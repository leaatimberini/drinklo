import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { SandboxService } from "./sandbox.service";
import { SetSandboxModeDto } from "./dto/sandbox.dto";

@ApiTags("sandbox")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/sandbox")
export class SandboxController {
  constructor(private readonly sandbox: SandboxService) {}

  @Get("status")
  @Permissions("settings:write")
  status(@Req() req: any) {
    return this.sandbox.getStatus(req.user.companyId);
  }

  @Post("mode")
  @Permissions("settings:write")
  setMode(@Req() req: any, @Body() body: SetSandboxModeDto) {
    return this.sandbox.setMode(req.user.companyId, body.sandboxMode);
  }

  @Post("reset")
  @Permissions("settings:write")
  reset(@Req() req: any) {
    return this.sandbox.resetCompany(req.user.companyId);
  }

  @Post("simulate-payment/:orderId")
  @Permissions("settings:write")
  simulatePayment(@Req() req: any, @Param("orderId") orderId: string) {
    return this.sandbox.approveSandboxPayment(req.user.companyId, orderId);
  }
}
