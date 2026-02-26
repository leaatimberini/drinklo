import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { SearchConfigDto, SearchQueryDto, SearchReindexDto } from "./dto/search.dto";
import { SearchService } from "./search.service";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async searchCatalog(@Query() query: SearchQueryDto) {
    const company = await this.search.getCompany();
    return this.search.searchCatalog(company.id, query.q ?? "", query.limit, query.offset);
  }
}

@ApiTags("search")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/search")
export class SearchAdminController {
  constructor(private readonly search: SearchService) {}

  @Get("config")
  @Roles("admin", "manager", "marketing")
  async getConfig(@Req() req: unknown) {
    return this.search.getConfig(req.user.companyId);
  }

  @Post("config")
  @Roles("admin", "manager", "marketing")
  async updateConfig(@Req() req: unknown, @Body() body: SearchConfigDto) {
    return this.search.updateConfig(req.user.companyId, body);
  }

  @Post("reindex")
  @Roles("admin")
  async reindex(@Req() req: unknown, @Body() body: SearchReindexDto) {
    return this.search.enqueueReindex(req.user.companyId, body.mode);
  }
}
