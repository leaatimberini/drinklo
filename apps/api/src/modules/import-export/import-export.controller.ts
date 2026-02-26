import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { ImportExportService, ImportType } from "./import-export.service";
import { ExportRequestDto, ImportAnalyzeRequestDto, ImportRequestDto, SaveImportMappingTemplateDto } from "./dto/import.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { parseFile, toCsv } from "./import.helpers";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AssistedImportService } from "./assisted-import.service";

@ApiTags("import-export")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/import")
export class ImportExportController {
  constructor(
    private readonly service: ImportExportService,
    private readonly prisma: PrismaService,
    private readonly assistedImport: AssistedImportService,
  ) {}

  @Post("assist/analyze")
  @Permissions("products:write")
  @UseInterceptors(FileInterceptor("file"))
  async analyzeImport(
    @Req() req: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportAnalyzeRequestDto,
  ) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const type = body.type as ImportType;
    if (!this.service.getSupportedTypes().includes(type)) {
      throw new BadRequestException("Unsupported import type");
    }

    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId: req.user.companyId },
      select: { onboardingIcp: true },
    });
    const icp = body.icp || settings?.onboardingIcp || "bebidas";
    const { headers, rows } = parseFile(file.buffer);
    const suggested = this.assistedImport.suggestMapping(type, headers, icp);
    const requestedMapping = this.parseColumnMapping(body.columnMappingJson);
    const appliedMapping = requestedMapping && Object.keys(requestedMapping).length > 0 ? requestedMapping : suggested.mapping;
    const mappedRows = this.assistedImport.applyMapping(rows, appliedMapping);
    const { errors, preview } = this.service.validate(type, mappedRows);
    const refErrors = await this.service.validateRefs(type, req.user.companyId, mappedRows);
    const allErrors = [...errors, ...refErrors];

    return {
      ok: allErrors.length === 0,
      type,
      icp,
      rawHeaders: headers,
      templates: this.assistedImport.listTemplates(req.user.companyId, type, icp),
      suggested,
      appliedMapping,
      report: {
        canImport: allErrors.length === 0,
        count: rows.length,
        errors: allErrors,
        previewRaw: rows.slice(0, 10),
        previewMapped: preview,
      },
    };
  }

  @Post()
  @Permissions("products:write")
  @UseInterceptors(FileInterceptor("file"))
  async importFile(
    @Req() req: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportRequestDto,
  ) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const type = body.type as ImportType;
    if (!this.service.getSupportedTypes().includes(type)) {
      throw new BadRequestException("Unsupported import type");
    }

    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId: req.user.companyId },
      select: { onboardingIcp: true },
    });
    const icp = body.icp || settings?.onboardingIcp || "bebidas";
    const { rows } = parseFile(file.buffer);
    const mapping = this.parseColumnMapping(body.columnMappingJson);
    const mappedRows = this.assistedImport.applyMapping(rows, mapping);
    const { errors, preview } = this.service.validate(type, mappedRows);
    const refErrors = await this.service.validateRefs(type, req.user.companyId, mappedRows);
    const allErrors = [...errors, ...refErrors];

    if (allErrors.length > 0) {
      return { ok: false, dryRun: true, errors: allErrors, count: mappedRows.length, preview, mappingApplied: mapping ?? null };
    }

    const dryRun = body.dryRun ?? false;
    if (dryRun) {
      if (body.saveMappingTemplate && body.mappingTemplateName && mapping) {
        this.assistedImport.upsertTemplate({
          companyId: req.user.companyId,
          type,
          icp,
          name: body.mappingTemplateName,
          mapping,
        });
      }
      return { ok: true, dryRun: true, errors: [], count: mappedRows.length, preview, mappingApplied: mapping ?? null };
    }

    await this.service.apply(type, req.user.companyId, mappedRows);
    if (body.saveMappingTemplate && body.mappingTemplateName && mapping) {
      this.assistedImport.upsertTemplate({
        companyId: req.user.companyId,
        type,
        icp,
        name: body.mappingTemplateName,
        mapping,
      });
    }
    return { ok: true, dryRun: false, errors: [], count: mappedRows.length, preview: [], mappingApplied: mapping ?? null };
  }

  @Get("assist/templates")
  @Permissions("products:read")
  async listTemplates(@Req() req: unknown, @Query("type") type?: string, @Query("icp") icp?: string) {
    const importType = type && this.service.getSupportedTypes().includes(type as ImportType) ? (type as ImportType) : undefined;
    return {
      items: this.assistedImport.listTemplates(req.user.companyId, importType, icp),
    };
  }

  @Post("assist/templates")
  @Permissions("products:write")
  async saveTemplate(@Req() req: unknown, @Body() body: SaveImportMappingTemplateDto) {
    const type = body.type as ImportType;
    if (!this.service.getSupportedTypes().includes(type)) {
      throw new BadRequestException("Unsupported import type");
    }
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId: req.user.companyId },
      select: { onboardingIcp: true },
    });
    const icp = body.icp || settings?.onboardingIcp || "bebidas";
    const template = this.assistedImport.upsertTemplate({
      companyId: req.user.companyId,
      type,
      icp,
      name: body.name,
      mapping: body.mapping ?? {},
    });
    return { ok: true, template };
  }

  @Delete("assist/templates/:id")
  @Permissions("products:write")
  async deleteTemplate(@Req() req: unknown, @Param("id") id: string) {
    return { ok: this.assistedImport.deleteTemplate(req.user.companyId, id) };
  }

  @Get("export")
  @Permissions("products:read")
  async exportFile(@Req() req: unknown, @Query() query: ExportRequestDto, @Res() res: Response) {
    const type = query.type as ImportType;
    if (!this.service.getSupportedTypes().includes(type)) {
      throw new BadRequestException("Unsupported export type");
    }

    const data = await this.buildExport(req.user.companyId, type);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${type}.csv`);
    res.send(data.csv);
  }

  private async buildExport(companyId: string, type: ImportType) {
    if (type === "products") {
      const products = await this.prisma.product.findMany({ where: { companyId, deletedAt: null }, include: { variants: true } });
      const rows = products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        imageUrl: p.imageUrl ?? "",
        isAlcoholic: p.isAlcoholic,
        abv: p.abv ?? "",
        sku: p.variants[0]?.sku ?? "",
        barcode: p.variants[0]?.barcode ?? "",
      }));
      const headers = ["id", "name", "description", "imageUrl", "isAlcoholic", "abv", "sku", "barcode"];
      return { csv: toCsv(rows, headers) };
    }

    if (type === "variants") {
      const variants = await this.prisma.productVariant.findMany({ where: { companyId, deletedAt: null } });
      const rows = variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode ?? "",
      }));
      const headers = ["id", "productId", "name", "sku", "barcode"];
      return { csv: toCsv(rows, headers) };
    }

    if (type === "prices") {
      const rules = await this.prisma.priceRule.findMany({
        where: { companyId },
        include: { priceList: true, variant: true },
      });
      const rows = rules.map((r) => ({
        priceList: r.priceList.name,
        variantSku: r.variant?.sku ?? "",
        price: r.price.toString(),
      }));
      const headers = ["priceList", "variantSku", "price"];
      return { csv: toCsv(rows, headers) };
    }

    if (type === "stock") {
      const items = await this.prisma.stockItem.findMany({
        where: { companyId },
        include: { variant: true, location: true },
      });
      const rows = items.map((item) => ({
        variantSku: item.variant.sku,
        location: item.location.name,
        quantity: item.quantity,
      }));
      const headers = ["variantSku", "location", "quantity"];
      return { csv: toCsv(rows, headers) };
    }

    const customers = await this.prisma.customer.findMany({
      where: { companyId },
      include: { addresses: true },
    });
    const rows = customers.map((c) => ({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      line1: c.addresses[0]?.line1 ?? "",
      line2: c.addresses[0]?.line2 ?? "",
      city: c.addresses[0]?.city ?? "",
      state: c.addresses[0]?.state ?? "",
      postalCode: c.addresses[0]?.postalCode ?? "",
      country: c.addresses[0]?.country ?? "",
    }));
    const headers = ["name", "email", "phone", "line1", "line2", "city", "state", "postalCode", "country"];
    return { csv: toCsv(rows, headers) };
  }

  private parseColumnMapping(raw: unknown) {
    if (!raw) return null;
    if (typeof raw === "object") {
      return raw as Record<string, string | null>;
    }
    if (typeof raw !== "string") {
      throw new BadRequestException("Invalid columnMappingJson");
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string | null>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid mapping");
      }
      return parsed;
    } catch {
      throw new BadRequestException("Invalid columnMappingJson");
    }
  }
}
