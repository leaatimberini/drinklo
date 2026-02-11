import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../common/rbac.decorators";
import { RolesGuard } from "../common/roles.guard";
import { CompaniesService } from "./companies.service";

@ApiTags("companies")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @Roles("admin")
  list() {
    return this.companies.list();
  }

  @Get(":id")
  @Roles("admin")
  get(@Param("id") id: string) {
    return this.companies.get(id);
  }
}
