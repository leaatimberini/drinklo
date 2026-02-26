import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BillingService } from "./billing.service";
import { BillingPlanChangesService } from "./billing-plan-changes.service";
import { ArcaReadinessService } from "./arca-readiness.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CancelSubscriptionDto, PlanChangeDto } from "./dto/plan-change.dto";
import { ArcaReadinessDryRunDto, ArcaReadinessReportDto } from "./dto/arca-readiness.dto";
import { PdfService } from "../shared/pdf.service";
import { StorageService } from "../storage/storage.service";
import { AuthGuard } from "@nestjs/passport";
import { Permissions, SodAction } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import type { Response } from "express";

@ApiTags("billing")
@ApiBearerAuth()
@Controller("billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly planChanges: BillingPlanChangesService,
    private readonly arcaReadiness: ArcaReadinessService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  @Post("invoices")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  @SodAction("INVOICE_ISSUE")
  create(@Body() body: CreateInvoiceDto) {
    return this.billing.createInvoice(body);
  }

  @Get("invoices/:id/pdf")
  async invoicePdf(@Param("id") id: string, @Res() res: Response) {
    const invoice = await this.billing.getInvoice(id);
    const html = this.pdf.renderInvoiceTemplate(invoice);
    const buffer = await this.pdf.renderPdf(html);
    const key = `pdfs/invoices/${id}.pdf`;
    await this.storage.put(key, buffer, "application/pdf");
    const signedUrl = await this.storage.signedUrl(key);
    return res.redirect(signedUrl);
  }

  @Post("upgrade")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  @SodAction("PLAN_UPGRADE")
  upgrade(@Req() req: any, @Body() body: PlanChangeDto) {
    return this.planChanges.upgrade(req.user.companyId, body.targetTier, req.user.sub, Boolean(body.dryRun));
  }

  @Post("downgrade")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  @SodAction("PLAN_DOWNGRADE")
  downgrade(@Req() req: any, @Body() body: PlanChangeDto) {
    return this.planChanges.downgrade(req.user.companyId, body.targetTier, req.user.sub, Boolean(body.dryRun));
  }

  @Post("cancel")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  cancel(@Req() req: any, @Body() body: CancelSubscriptionDto) {
    return this.planChanges.cancel(req.user.companyId, req.user.sub, Boolean(body?.dryRun));
  }

  @Post("reactivate")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  reactivate(@Req() req: any) {
    return this.planChanges.reactivate(req.user.companyId, req.user.sub);
  }

  @Get("arca/readiness")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  getArcaReadiness(@Req() req: any) {
    const raw = req.query?.invoiceTypes;
    const invoiceTypes = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
    return this.arcaReadiness.getChecklist({ companyId: req.user.companyId, invoiceTypes: invoiceTypes as any });
  }

  @Post("arca/readiness/dry-run")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  @SodAction("ARCA_DRY_RUN")
  runArcaDryRun(@Req() req: any, @Body() body: ArcaReadinessDryRunDto) {
    return this.arcaReadiness.runDryRun(req.user.companyId, req.user.sub, body);
  }

  @Post("arca/readiness/report")
  @UseGuards(AuthGuard("jwt"), PermissionsGuard)
  @Permissions("settings:write")
  @SodAction("ARCA_READINESS_REPORT")
  generateArcaReadinessReport(@Req() req: any, @Body() body: ArcaReadinessReportDto) {
    return this.arcaReadiness.generateReport(req.user.companyId, req.user.sub, body);
  }
}
