import crypto from "node:crypto";
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RolePermissions } from "../common/rbac.constants";
import type { UpdateIamConfigDto } from "./dto/iam.dto";

function base32Encode(buffer: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += alphabet[Number.parseInt(chunk, 2)];
  }
  return out;
}

function base32Decode(input: string) {
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

function verifyTotp(secret: string, code: string, window = 1) {
  const now = Math.floor(Date.now() / 1000 / 30);
  const key = base32Decode(secret);
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

export function generateTotp(secret: string, timestampMs = Date.now()) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestampMs / 1000 / 30)));
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const dyn = hmac[hmac.length - 1] & 0x0f;
  const value = (hmac.readUInt32BE(dyn) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

@Injectable()
export class IamService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(companyId: string) {
    const config = await this.prisma.companyIamConfig.findUnique({ where: { companyId } });
    if (!config) {
      return this.prisma.companyIamConfig.create({ data: { companyId } });
    }
    return config;
  }

  async updateConfig(companyId: string, dto: UpdateIamConfigDto) {
    return this.prisma.companyIamConfig.upsert({
      where: { companyId },
      update: {
        ...dto,
      },
      create: {
        companyId,
        ...dto,
      },
    });
  }

  async testConnection(companyId: string, protocol: "OIDC" | "SAML") {
    const cfg = await this.getConfig(companyId);
    let ok = false;
    let error: string | undefined;

    if (protocol === "OIDC") {
      ok = Boolean(cfg.oidcIssuer && cfg.oidcClientId && cfg.oidcAuthUrl && cfg.oidcTokenUrl);
      if (!ok) error = "Missing OIDC required fields";
    } else {
      ok = Boolean(cfg.samlEntityId && cfg.samlSsoUrl && cfg.samlCertificate);
      if (!ok) error = "Missing SAML required fields";
    }

    await this.prisma.companyIamConfig.update({
      where: { companyId },
      data: {
        testStatus: ok ? "ok" : "failed",
        testLastError: ok ? null : error,
        testLastCheckedAt: new Date(),
      },
    });

    return { ok, protocol, error };
  }

  async setupMfa(userId: string, email: string) {
    const raw = crypto.randomBytes(20);
    const secret = base32Encode(raw);
    const uri = `otpauth://totp/ERP:${encodeURIComponent(email)}?secret=${secret}&issuer=ERP`;
    const existing = await this.prisma.userMfaConfig.findUnique({ where: { userId } });
    if (existing) {
      await this.prisma.userMfaConfig.update({
        where: { userId },
        data: { secret, enabled: false, verifiedAt: null },
      });
    } else {
      await this.prisma.userMfaConfig.create({
        data: { userId, secret, enabled: false },
      });
    }
    return { secret, otpauthUrl: uri };
  }

  async verifyMfa(userId: string, code: string) {
    const mfa = await this.prisma.userMfaConfig.findUnique({ where: { userId } });
    if (!mfa) {
      throw new NotFoundException("MFA not initialized");
    }
    const ok = verifyTotp(mfa.secret, code);
    if (!ok) {
      throw new UnauthorizedException("Invalid MFA code");
    }
    await this.prisma.userMfaConfig.update({
      where: { userId },
      data: { enabled: true, verifiedAt: new Date() },
    });
    return { ok: true };
  }

  async authenticateSsoMock(protocol: "OIDC" | "SAML", token: string, companyId?: string) {
    if (!token.startsWith("mock:")) {
      throw new UnauthorizedException("Only mock token supported in this environment");
    }

    const cfgWhere = companyId ? { companyId } : undefined;
    const cfg = cfgWhere
      ? await this.prisma.companyIamConfig.findUnique({ where: cfgWhere })
      : await this.prisma.companyIamConfig.findFirst({ where: { ssoEnabled: true, ssoProtocol: protocol } });
    if (!cfg || !cfg.ssoEnabled || cfg.ssoProtocol !== protocol) {
      throw new UnauthorizedException("SSO not configured");
    }

    const [, emailRaw, nameRaw] = token.split(":");
    const email = String(emailRaw ?? "").trim().toLowerCase();
    const name = String(nameRaw ?? email.split("@")[0] ?? "SSO User");
    if (!email) {
      throw new UnauthorizedException("Invalid mock token");
    }

    let user = await this.prisma.user.findFirst({ where: { companyId: cfg.companyId, email }, include: { role: true } });
    if (!user) {
      const adminRole = await this.prisma.role.findFirst({ where: { companyId: cfg.companyId, name: { equals: "admin", mode: "insensitive" } } });
      const fallbackRole = adminRole ?? (await this.prisma.role.findFirst({ where: { companyId: cfg.companyId } }));
      if (!fallbackRole) {
        throw new NotFoundException("No roles configured for company");
      }
      user = await this.prisma.user.create({
        data: {
          companyId: cfg.companyId,
          roleId: fallbackRole.id,
          email,
          name,
          passwordHash: `SSO_ONLY_${protocol}`,
        },
        include: { role: true },
      });
    }

    return user;
  }

  async scimCreateUserByToken(token: string, payload: any) {
    const cfg = await this.prisma.companyIamConfig.findFirst({ where: { scimEnabled: true, scimBearerToken: token } });
    if (!cfg) {
      throw new UnauthorizedException("Invalid SCIM token");
    }
    const userName = String(payload?.userName ?? "").toLowerCase();
    const displayName = String(payload?.displayName ?? userName.split("@")[0] ?? "SCIM User");
    if (!userName) {
      throw new NotFoundException("userName required");
    }

    let user = await this.prisma.user.findFirst({ where: { companyId: cfg.companyId, email: userName }, include: { role: true } });
    if (!user) {
      const role = await this.prisma.role.findFirst({ where: { companyId: cfg.companyId, name: { equals: "manager", mode: "insensitive" } } })
        ?? await this.prisma.role.findFirst({ where: { companyId: cfg.companyId } });
      if (!role) {
        throw new NotFoundException("role not found");
      }
      user = await this.prisma.user.create({
        data: {
          companyId: cfg.companyId,
          roleId: role.id,
          email: userName,
          name: displayName,
          passwordHash: "SCIM_MANAGED",
        },
        include: { role: true },
      });
    }

    await this.prisma.scimProvisionLog.create({
      data: {
        companyId: cfg.companyId,
        externalId: String(payload?.externalId ?? "") || null,
        email: user.email,
        action: "create",
        status: "ok",
        payload,
      },
    });

    return user;
  }

  async scimDisableUserByToken(token: string, userId: string, payload: any) {
    const cfg = await this.prisma.companyIamConfig.findFirst({ where: { scimEnabled: true, scimBearerToken: token } });
    if (!cfg) {
      throw new UnauthorizedException("Invalid SCIM token");
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId: cfg.companyId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.scimProvisionLog.create({
      data: {
        companyId: cfg.companyId,
        externalId: String(payload?.externalId ?? "") || null,
        email: user.email,
        action: "disable",
        status: "ok",
        payload,
      },
    });

    return { ok: true };
  }

  summarizeStatus(config: any) {
    const mfaRoles = (config?.mfaRequiredRoles ?? []).filter((role: string) => role in RolePermissions);
    return {
      ssoEnabled: Boolean(config?.ssoEnabled),
      protocol: config?.ssoProtocol ?? "NONE",
      mfaEnabled: Boolean(config?.mfaEnabled),
      mfaRoles,
      scimEnabled: Boolean(config?.scimEnabled),
      testStatus: config?.testStatus ?? null,
      testLastCheckedAt: config?.testLastCheckedAt ?? null,
    };
  }
}

