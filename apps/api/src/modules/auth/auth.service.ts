import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { RoleName } from "../common/rbac.constants";
import { RolePermissions } from "../common/rbac.constants";

export type JwtPayload = {
  sub: string;
  companyId: string;
  role: RoleName;
  permissions: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { role: true },
    });
    if (!user || user.deletedAt) {
      return null;
    }

    const stored = user.passwordHash;
    const isBcrypt = stored.startsWith("$2");
    const matches = isBcrypt ? await bcrypt.compare(password, stored) : password === stored;
    if (!matches) {
      return null;
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const roleName = (user.role.name.toLowerCase() as RoleName) ?? "manager";
    const permissions = RolePermissions[roleName] ?? [];
    const payload: JwtPayload = {
      sub: user.id,
      companyId: user.companyId,
      role: roleName,
      permissions,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: roleName,
      },
    };
  }
}
