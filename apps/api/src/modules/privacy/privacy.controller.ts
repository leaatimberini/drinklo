import { Controller, Get, Param, Query, Req, Res, Patch, Body, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "../common/rbac.decorators";
import { PermissionsGuard } from "../common/permissions.guard";
import { PrivacyService } from "./privacy.service";
import { RetentionPolicyDto, AnonymizeRequestDto } from "./dto/privacy.dto";
import { toCsv } from "../import-export/import.helpers";
import type { Response } from "express";

@ApiTags("privacy")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("admin/privacy")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get("customers/:id/export")
  @Permissions("customers:read")
  async exportCustomer(
    @Req() req: any,
    @Param("id") id: string,
    @Query("format") format: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.privacy.exportCustomer(req.user.companyId, id);

    if (format === "csv") {
      const rows = data.addresses.length > 0
        ? data.addresses.map((addr) => ({
            customerId: data.customer.id,
            name: data.customer.name,
            email: data.customer.email ?? "",
            phone: data.customer.phone ?? "",
            line1: addr.line1,
            line2: addr.line2 ?? "",
            city: addr.city,
            state: addr.state ?? "",
            postalCode: addr.postalCode,
            country: addr.country,
          }))
        : [
            {
              customerId: data.customer.id,
              name: data.customer.name,
              email: data.customer.email ?? "",
              phone: data.customer.phone ?? "",
              line1: "",
              line2: "",
              city: "",
              state: "",
              postalCode: "",
              country: "",
            },
          ];
      const headers = ["customerId", "name", "email", "phone", "line1", "line2", "city", "state", "postalCode", "country"];
      const csv = toCsv(rows, headers);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=customer-${id}.csv`);
      return res.send(csv);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=customer-${id}.json`);
    return res.send(JSON.stringify(data, null, 2));
  }

  @Post("customers/:id/anonymize")
  @Permissions("customers:write")
  anonymize(@Req() req: any, @Param("id") id: string, @Body() body: AnonymizeRequestDto) {
    return this.privacy.anonymizeCustomer(req.user.companyId, id, req.user.sub, body.notes);
  }

  @Get("policies")
  @Permissions("settings:write")
  policies(@Req() req: any) {
    return this.privacy.getRetentionPolicy(req.user.companyId);
  }

  @Patch("policies")
  @Permissions("settings:write")
  updatePolicies(@Req() req: any, @Body() body: RetentionPolicyDto) {
    return this.privacy.updateRetentionPolicy(req.user.companyId, body);
  }
}
