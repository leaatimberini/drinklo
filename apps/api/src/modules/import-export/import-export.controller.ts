import { BadRequestException, Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { ImportExportService, ImportType } from "./import-export.service";
import { ImportRequestDto, ExportRequestDto } from "./dto/import.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { parseFile, toCsv } from "./import.helpers";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("import-export")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/import")
export class ImportExportController {
  constructor(
    private readonly service: ImportExportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Permissions("products:write")
  @UseInterceptors(FileInterceptor("file"))
  async importFile(
    @Req() req: any,
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

    const { rows } = parseFile(file.buffer);
    const { errors, preview } = this.service.validate(type, rows);
    const refErrors = await this.service.validateRefs(type, req.user.companyId, rows);
    const allErrors = [...errors, ...refErrors];

    if (allErrors.length > 0) {
      return { ok: false, dryRun: true, errors: allErrors, count: rows.length, preview };
    }

    const dryRun = body.dryRun ?? false;
    if (dryRun) {
      return { ok: true, dryRun: true, errors: [], count: rows.length, preview };
    }

    await this.service.apply(type, req.user.companyId, rows);
    return { ok: true, dryRun: false, errors: [], count: rows.length, preview: [] };
  }

  @Get("export")
  @Permissions("products:read")
  async exportFile(@Req() req: any, @Query() query: ExportRequestDto, @Res() res: Response) {
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
}
