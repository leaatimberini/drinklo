import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import bcrypt from "bcryptjs";

@Injectable()
export class PortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateLogin(email: string, password: string, companyId?: string) {
    const customer = await this.prisma.supportCustomer.findFirst({
      where: { email, ...(companyId ? { companyId } : {}) },
      include: { company: true },
    });
    if (!customer) return null;
    const ok = await bcrypt.compare(password, customer.passwordHash);
    if (!ok) return null;

    await this.prisma.supportCustomer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: customer.id,
      companyId: customer.companyId,
      email: customer.email,
      name: customer.name,
      companyName: customer.company.name,
    };
  }

  sign(payload: { sub: string; companyId: string; email: string }) {
    return this.jwt.sign(payload);
  }
}
