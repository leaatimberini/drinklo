import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import type { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";
import { StorageService } from "../storage/storage.service";
import { FileInterceptor } from "@nestjs/platform-express";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("products")
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Permissions("products:read")
  list(@Req() req: any) {
    return this.products.list(req.user.companyId);
  }

  @Get(":id")
  @Permissions("products:read")
  get(@Req() req: any, @Param("id") id: string) {
    return this.products.get(req.user.companyId, id);
  }

  @Post()
  @Permissions("products:write")
  create(@Req() req: any, @Body() body: CreateProductDto) {
    return this.products.create(req.user.companyId, body, req.user.sub);
  }

  @Patch(":id")
  @Permissions("products:write")
  update(@Req() req: any, @Param("id") id: string, @Body() body: UpdateProductDto) {
    return this.products.update(req.user.companyId, id, body, req.user.sub);
  }

  @Delete(":id")
  @Permissions("products:write")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.products.remove(req.user.companyId, id, req.user.sub);
  }

  @Post(":id/image")
  @Permissions("products:write")
  @UseInterceptors(FileInterceptor("file"))
  async uploadImage(@Req() req: any, @Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const ext = file.originalname.split(".").pop() ?? "png";
    const key = `assets/${req.user.companyId}/products/${id}-${Date.now()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype, "public, max-age=31536000");
    const imageUrl = await this.storage.publicUrl(key);
    return this.products.update(req.user.companyId, id, { imageUrl }, req.user.sub);
  }
}
