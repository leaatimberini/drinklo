import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions, SodAction } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { PurchasingService } from "./purchasing.service";
import {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  CreateSupplierInvoiceDto,
  ReceiveGoodsDto,
} from "./dto/purchasing.dto";

@ApiTags("purchasing")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("purchasing")
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get("suppliers")
  @Permissions("inventory:read")
  suppliers(@Req() req: any) {
    return this.purchasing.listSuppliers(req.user.companyId);
  }

  @Post("suppliers")
  @Permissions("inventory:write")
  createSupplier(@Req() req: any, @Body() body: CreateSupplierDto) {
    return this.purchasing.createSupplier(req.user.companyId, body);
  }

  @Get("orders")
  @Permissions("inventory:read")
  orders(@Req() req: any) {
    return this.purchasing.listPurchaseOrders(req.user.companyId);
  }

  @Post("orders")
  @Permissions("inventory:write")
  createOrder(@Req() req: any, @Body() body: CreatePurchaseOrderDto) {
    return this.purchasing.createPurchaseOrder(req.user.companyId, body, req.user.sub);
  }

  @Post("orders/:id/approve")
  @Permissions("inventory:write")
  @SodAction("PURCHASE_APPROVE")
  approveOrder(@Req() req: any, @Param("id") id: string) {
    return this.purchasing.approvePurchaseOrder(req.user.companyId, id, req.user.sub);
  }

  @Post("orders/:id/receive")
  @Permissions("inventory:write")
  receive(@Req() req: any, @Param("id") id: string, @Body() body: ReceiveGoodsDto) {
    return this.purchasing.receiveGoods(req.user.companyId, id, body, req.user.sub);
  }

  @Post("supplier-invoices")
  @Permissions("inventory:write")
  createSupplierInvoice(@Req() req: any, @Body() body: CreateSupplierInvoiceDto) {
    return this.purchasing.createSupplierInvoice(req.user.companyId, body);
  }

  @Get("reports/accounts-payable")
  @Permissions("inventory:read")
  accountsPayable(@Req() req: any) {
    return this.purchasing.reportAccountsPayable(req.user.companyId);
  }

  @Get("reports/by-supplier")
  @Permissions("inventory:read")
  bySupplier(@Req() req: any) {
    return this.purchasing.reportPurchasesBySupplier(req.user.companyId);
  }

  @Get("reports/cost-variance")
  @Permissions("inventory:read")
  costVariance(@Req() req: any) {
    return this.purchasing.reportCostVariance(req.user.companyId);
  }
}
