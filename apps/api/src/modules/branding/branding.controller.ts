import { BadRequestException, Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { AuthGuard } from "@nestjs/passport";
import { BrandingService } from "./branding.service";
import { BrandingImportDto } from "./dto/branding-import.dto";
import { SuperAdminGuard } from "./superadmin.guard";
import { StorageService } from "../storage/storage.service";
import { FileInterceptor } from "@nestjs/platform-express";

@ApiTags("branding")
@Controller("admin/branding")
export class BrandingController {
  constructor(
    private readonly branding: BrandingService,
    private readonly storage: StorageService,
  ) {}

  @Post("export")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  exportBrand() {
    return this.branding.exportSigned();
  }

  @Post("import")
  @UseGuards(SuperAdminGuard)
  importBrand(@Body() body: BrandingImportDto) {
    return this.branding.validateImport(body.payload as unknown, body.signature).then(async (sanitized) => {
      if (body.apply) {
        const applied = await this.branding.applyImport(sanitized);
        return { applied: true, settings: applied };
      }
      return { applied: false, preview: sanitized };
    });
  }

  @Post("logo")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "marketing")
  @UseInterceptors(FileInterceptor("file"))
  async uploadLogo(@Req() req: unknown, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const ext = file.originalname.split(".").pop() ?? "png";
    const key = `assets/${req.user.companyId}/branding/logo-${Date.now()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype, "public, max-age=31536000");
    const logoUrl = await this.storage.publicUrl(key);
    return this.branding.updateAssets(req.user.companyId, { logoUrl });
  }

  @Post("favicon")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin", "marketing")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFavicon(@Req() req: unknown, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const ext = file.originalname.split(".").pop() ?? "png";
    const key = `assets/${req.user.companyId}/branding/favicon-${Date.now()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype, "public, max-age=31536000");
    const faviconUrl = await this.storage.publicUrl(key);
    return this.branding.updateAssets(req.user.companyId, { faviconUrl });
  }
}
