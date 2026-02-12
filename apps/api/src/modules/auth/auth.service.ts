import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { RoleName } from "../common/rbac.constants";
import { RolePermissions } from "../common/rbac.constants";

export type JwtPayload = {
  sub: string;
  companyId: string;
  role: RoleName;
  permissions: string[];
  email?: string;
  name?: string;
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

  private base32Decode(input: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const ch of input.replace(/=+$/g, "").toUpperCase()) {
      const value = alphabet.indexOf(ch);
      if (value < 0) continue;
      bits += value.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }

  private verifyTotp(secret: string, code: string, window = 1) {
    const now = Math.floor(Date.now() / 1000 / 30);
    const key = this.base32Decode(secret);
    for (let offset = -window; offset <= window; offset += 1) {
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(now + offset));
      const hmac = crypto.createHmac("sha1", key).update(counter).digest();
      const dyn = hmac[hmac.length - 1] & 0x0f;
      const value = (hmac.readUInt32BE(dyn) & 0x7fffffff) % 1_000_000;
      const expected = String(value).padStart(6, "0");
      if (expected === code) {
        return true;
      }
    }
    return false;
  }

  async issueTokenForUser(user: {
    id: string;
    companyId: string;
    email: string;
    name: string;
    role: { name: string };
  }) {
    const roleName = (user.role.name.toLowerCase() as RoleName) ?? "manager";
    const permissions = RolePermissions[roleName] ?? [];
    const payload: JwtPayload = {
      sub: user.id,
      companyId: user.companyId,
      role: roleName,
      permissions,
      email: user.email,
      name: user.name,
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

  async login(email: string, password: string, mfaCode?: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const roleName = (user.role.name.toLowerCase() as RoleName) ?? "manager";
    const iam = await this.prisma.companyIamConfig.findUnique({ where: { companyId: user.companyId } });
    const mfaRoles = new Set((iam?.mfaRequiredRoles ?? []).map((v) => String(v).toLowerCase()));
    const mfaRequired = Boolean(iam?.mfaEnabled) && mfaRoles.has(roleName);
    if (mfaRequired) {
      const mfa = await this.prisma.userMfaConfig.findUnique({ where: { userId: user.id } });
      if (!mfa?.enabled || !mfa.verifiedAt) {
        return {
          mfaRequired: true,
          mfaSetupRequired: true,
          message: "MFA setup required",
        };
      }
      if (!mfaCode || !this.verifyTotp(mfa.secret, mfaCode)) {
        return {
          mfaRequired: true,
          message: "MFA code required",
        };
      }
    }

    return this.issueTokenForUser(user);
  }
}
