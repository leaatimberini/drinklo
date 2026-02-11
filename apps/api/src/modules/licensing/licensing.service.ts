import crypto from "node:crypto";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { LicensePayload, LicenseValidationResult, PremiumFeature } from "./license.types";

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  return Buffer.from(pad, "base64").toString("utf8");
}

@Injectable()
export class LicensingService {
  constructor(private readonly prisma: PrismaService) {}

  generateKey(payload: LicensePayload, secret: string) {
    const json = JSON.stringify(payload);
    const encoded = base64UrlEncode(json);
    const signature = crypto.createHmac("sha256", secret).update(encoded).digest("hex");
    return `${encoded}.${signature}`;
  }

  parseKey(key: string, secret: string): LicensePayload {
    const [encoded, signature] = key.split(".");
    if (!encoded || !signature) {
      throw new Error("Invalid license key format");
    }
    const expected = crypto.createHmac("sha256", secret).update(encoded).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new Error("Invalid license signature");
    }
    const payload = JSON.parse(base64UrlDecode(encoded)) as LicensePayload;
    return payload;
  }

  async generate(companyId: string, plan: string, expiresAt: string, features: string[]) {
    const secret = process.env.LICENSE_SECRET ?? "";
    if (!secret) {
      throw new Error("LICENSE_SECRET missing");
    }
    const payload: LicensePayload = {
      companyId,
      plan,
      expiresAt,
      features,
      issuedAt: new Date().toISOString(),
    };
    const key = this.generateKey(payload, secret);
    await this.upsert(companyId, key, payload);
    return { key, payload };
  }

  async apply(companyId: string, licenseKey: string) {
    const secret = process.env.LICENSE_SECRET ?? "";
    if (!secret) {
      throw new Error("LICENSE_SECRET missing");
    }
    const payload = this.parseKey(licenseKey, secret);
    if (payload.companyId !== companyId) {
      throw new Error("License company mismatch");
    }
    await this.upsert(companyId, licenseKey, payload);
    return payload;
  }

  private async upsert(companyId: string, licenseKey: string, payload: LicensePayload) {
    await this.prisma.licenseKey.upsert({
      where: { companyId },
      update: {
        key: licenseKey,
        plan: payload.plan,
        expiresAt: new Date(payload.expiresAt),
        features: payload.features,
      },
      create: {
        companyId,
        key: licenseKey,
        plan: payload.plan,
        expiresAt: new Date(payload.expiresAt),
        features: payload.features,
      },
    });
  }

  async getStatus(companyId: string): Promise<LicenseValidationResult> {
    const license = await this.prisma.licenseKey.findUnique({ where: { companyId } });
    if (!license) {
      return {
        valid: false,
        plan: null,
        expiresAt: null,
        features: [],
        source: "local",
        reason: "missing",
      };
    }

    const now = Date.now();
    const expired = license.expiresAt.getTime() < now;
    const localResult: LicenseValidationResult = {
      valid: !expired,
      plan: license.plan,
      expiresAt: license.expiresAt.toISOString(),
      features: license.features,
      source: "local",
      reason: expired ? "expired" : undefined,
    };

    const serverUrl = process.env.LICENSE_SERVER_URL;
    if (!serverUrl) {
      return localResult;
    }

    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, "")}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, licenseKey: license.key, instanceId: process.env.INSTANCE_ID }),
      });
      if (!response.ok) {
        return localResult;
      }
      const data = (await response.json()) as { valid: boolean; plan?: string; expiresAt?: string; features?: string[]; reason?: string };
      return {
        valid: Boolean(data.valid),
        plan: data.plan ?? license.plan,
        expiresAt: data.expiresAt ?? license.expiresAt.toISOString(),
        features: data.features ?? license.features,
        source: "remote",
        reason: data.reason,
      };
    } catch {
      return localResult;
    }
  }

  async isFeatureEnabled(companyId: string, feature: PremiumFeature) {
    const status = await this.getStatus(companyId);
    if (!status.valid) return false;
    return status.features.includes(feature);
  }

  async requireFeature(companyId: string, feature: PremiumFeature) {
    const enabled = await this.isFeatureEnabled(companyId, feature);
    if (!enabled) {
      throw new ForbiddenException(`Feature ${feature} not licensed`);
    }
  }
}
