import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { SodAccessReviewsService } from "./sod-access-reviews.service";
import {
  CreateAccessReviewCampaignDto,
  ReviewAccessReviewItemDto,
  SodViolationsQueryDto,
  UpsertSodPoliciesDto,
} from "./dto/sod-access-reviews.dto";

@ApiTags("sod-access-reviews")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/sod")
export class SodAccessReviewsController {
  constructor(private readonly sod: SodAccessReviewsService) {}

  @Get("policies")
  @Permissions("settings:write")
  listPolicies(@Req() req: any) {
    return this.sod.listPolicies(req.user.companyId);
  }

  @Put("policies")
  @Permissions("settings:write")
  upsertPolicies(@Req() req: any, @Body() body: UpsertSodPoliciesDto) {
    return this.sod.upsertPolicies(req.user.companyId, body, req.user.sub);
  }

  @Get("violations")
  @Permissions("settings:write")
  listViolations(@Req() req: any, @Query() query: SodViolationsQueryDto) {
    return this.sod.listViolations(req.user.companyId, query.limit ?? 50);
  }

  @Get("summary")
  @Permissions("settings:write")
  summary(@Req() req: any) {
    return this.sod.getSummary(req.user.companyId);
  }

  @Post("report-control-plane")
  @Permissions("settings:write")
  async reportControlPlane(@Req() req: any) {
    await this.sod.reportToControlPlane(req.user.companyId);
    return { ok: true };
  }

  @Get("access-reviews/campaigns")
  @Permissions("users:read")
  listCampaigns(@Req() req: any) {
    return this.sod.listAccessReviewCampaigns(req.user.companyId);
  }

  @Post("access-reviews/campaigns")
  @Permissions("users:write")
  createCampaign(@Req() req: any, @Body() body: CreateAccessReviewCampaignDto) {
    return this.sod.createAccessReviewCampaign(req.user.companyId, body, req.user.sub);
  }

  @Get("access-reviews/campaigns/:id/items")
  @Permissions("users:read")
  campaignItems(@Req() req: any, @Param("id") id: string) {
    return this.sod.listAccessReviewItems(req.user.companyId, id);
  }

  @Post("access-reviews/items/:id/review")
  @Permissions("users:write")
  reviewItem(@Req() req: any, @Param("id") id: string, @Body() body: ReviewAccessReviewItemDto) {
    return this.sod.reviewAccessReviewItem(req.user.companyId, id, body, req.user.sub);
  }

  @Post("access-reviews/campaigns/:id/approve")
  @Permissions("users:write")
  approveCampaign(@Req() req: any, @Param("id") id: string) {
    return this.sod.approveCampaign(req.user.companyId, id, req.user.sub);
  }

  @Post("access-reviews/campaigns/:id/complete")
  @Permissions("users:write")
  completeCampaign(@Req() req: any, @Param("id") id: string) {
    return this.sod.completeCampaign(req.user.companyId, id, req.user.sub);
  }
}
