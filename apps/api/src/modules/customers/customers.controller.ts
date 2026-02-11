import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import type { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { CustomersService } from "./customers.service";

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Permissions("customers:read")
  list(@Req() req: any) {
    return this.customers.list(req.user.companyId);
  }

  @Get(":id")
  @Permissions("customers:read")
  get(@Req() req: any, @Param("id") id: string) {
    return this.customers.get(req.user.companyId, id);
  }

  @Post()
  @Permissions("customers:write")
  create(@Req() req: any, @Body() body: CreateCustomerDto) {
    return this.customers.create(req.user.companyId, body, req.user.sub);
  }

  @Patch(":id")
  @Permissions("customers:write")
  update(@Req() req: any, @Param("id") id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(req.user.companyId, id, body, req.user.sub);
  }

  @Delete(":id")
  @Permissions("customers:write")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.customers.remove(req.user.companyId, id, req.user.sub);
  }
}
