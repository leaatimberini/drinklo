import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

@ApiTags("subscription-lifecycle")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/plans/lifecycle")
export class SubscriptionLifecycleController {
  constructor(private readonly lifecycle: SubscriptionLifecycleService) {}

  @Get("notifications")
  @Roles("admin", "manager", "support")
  notifications(@Req() req: unknown, @Query("limit") limit?: string) {
    const parsed = Number(limit);
    return this.lifecycle.listRecentNotifications(req.user.companyId, Number.isFinite(parsed) ? parsed : 20);
  }

  @Post("run/:job")
  @Roles("admin", "support")
  run(@Param("job") job: string) {
    const allowed = ["trial-expirer", "grace-expirer", "past-due-handler", "trial-reminder-notifier"] as const;
    if (!allowed.includes(job as unknown)) {
      return { ok: false, error: "invalid_job" };
    }
    return this.lifecycle.runJob(job as unknown, new Date(), "manual");
  }
}

