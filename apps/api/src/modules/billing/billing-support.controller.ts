import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { BillingPlanChangesService } from "./billing-plan-changes.service";
import { CancelSubscriptionDto, PlanChangeDto } from "./dto/plan-change.dto";

@ApiTags("billing-support")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/support/billing")
export class BillingSupportController {
  constructor(private readonly planChanges: BillingPlanChangesService) {}

  @Post(":companyId/upgrade")
  @Roles("admin", "support")
  upgrade(@Param("companyId") companyId: string, @Body() body: PlanChangeDto) {
    return this.planChanges.upgrade(companyId, body.targetTier, "support", Boolean(body.dryRun));
  }

  @Post(":companyId/downgrade")
  @Roles("admin", "support")
  downgrade(@Param("companyId") companyId: string, @Body() body: PlanChangeDto) {
    return this.planChanges.downgrade(companyId, body.targetTier, "support", Boolean(body.dryRun));
  }

  @Post(":companyId/cancel")
  @Roles("admin", "support")
  cancel(@Param("companyId") companyId: string, @Body() body: CancelSubscriptionDto) {
    return this.planChanges.cancel(companyId, "support", Boolean(body.dryRun));
  }

  @Post(":companyId/reactivate")
  @Roles("admin", "support")
  reactivate(@Param("companyId") companyId: string) {
    return this.planChanges.reactivate(companyId, "support");
  }

  @Post("apply-due")
  @Roles("admin", "support")
  applyDue(@Body() body?: { now?: string }) {
    const now = body?.now ? new Date(body.now) : new Date();
    return this.planChanges.applyDueScheduledChanges(now, "support");
  }
}
