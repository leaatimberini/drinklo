import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/rbac.decorators";
import { SupportService } from "./support.service";
import { PrismaService } from "../prisma/prisma.service";
import bcrypt from "bcryptjs";
import { Body } from "@nestjs/common";

@ApiTags("support")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("admin/support")
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("summary")
  @Roles("admin", "support")
  summary() {
    return this.support.summary();
  }

  @Get("status")
  @Roles("admin", "support")
  status() {
    return this.support.checkServices();
  }

  @Get("latency")
  @Roles("admin", "support")
  latency() {
    return this.support.checkServices();
  }

  @Post("smoke")
  @Roles("admin", "support")
  smoke() {
    return this.support.checkServices();
  }

  @Post("customers")
  @Roles("admin", "support")
  async createCustomer(@Body() body: any) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      return { ok: false, message: "Company not found" };
    }
    const passwordHash = await bcrypt.hash(String(body.password ?? "change_me"), 10);
    const customer = await this.prisma.supportCustomer.create({
      data: {
        companyId: company.id,
        email: String(body.email ?? "").toLowerCase(),
        name: String(body.name ?? "Customer"),
        passwordHash,
      },
    });
    return { ok: true, customerId: customer.id };
  }
}
