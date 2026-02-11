import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import type { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions("users:read")
  list(@Req() req: any) {
    return this.users.list(req.user.companyId);
  }

  @Get(":id")
  @Permissions("users:read")
  get(@Req() req: any, @Param("id") id: string) {
    return this.users.get(req.user.companyId, id);
  }

  @Post()
  @Permissions("users:write")
  create(@Req() req: any, @Body() body: CreateUserDto) {
    return this.users.create(req.user.companyId, body, req.user.sub);
  }

  @Patch(":id")
  @Permissions("users:write")
  update(@Req() req: any, @Param("id") id: string, @Body() body: UpdateUserDto) {
    return this.users.update(req.user.companyId, id, body, req.user.sub);
  }

  @Delete(":id")
  @Permissions("users:write")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.users.remove(req.user.companyId, id, req.user.sub);
  }
}
