import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { signPayload } from "./branding-sign";

const ALLOWED_FIELDS = [
  "brandName",
  "domain",
  "logoUrl",
  "faviconUrl",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "templateId",
  "storefrontTheme",
  "adminTheme",
] as const;

export type BrandingPayload = Record<(typeof ALLOWED_FIELDS)[number], string | null>;

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async exportSigned() {
    const company = await this.prisma.company.findFirst({ include: { settings: true } });
    if (!company?.settings) {
      throw new Error("Company settings not found");
    }

    const payload = ALLOWED_FIELDS.reduce((acc, key) => {
      acc[key] = (company.settings as any)[key] ?? null;
      return acc;
    }, {} as BrandingPayload);

    const secret = process.env.BRANDING_SECRET ?? "";
    if (!secret) {
      throw new Error("BRANDING_SECRET missing");
    }

    const signature = signPayload(payload, secret);
    return { payload, signature };
  }

  async validateImport(payload: BrandingPayload, signature: string) {
    const secret = process.env.BRANDING_SECRET ?? "";
    if (!secret) {
      throw new Error("BRANDING_SECRET missing");
    }
    const expected = signPayload(payload, secret);
    if (expected !== signature) {
      throw new Error("Invalid signature");
    }

    const sanitized = ALLOWED_FIELDS.reduce((acc, key) => {
      const value = payload[key];
      acc[key] = typeof value === "string" ? value : null;
      return acc;
    }, {} as BrandingPayload);

    return sanitized;
  }

  async applyImport(payload: BrandingPayload) {
    const company = await this.prisma.company.findFirst({ include: { settings: true } });
    if (!company?.settings) {
      throw new Error("Company settings not found");
    }

    return this.prisma.companySettings.update({
      where: { companyId: company.id },
      data: {
        brandName: payload.brandName ?? company.settings.brandName,
        domain: payload.domain ?? company.settings.domain,
        logoUrl: payload.logoUrl ?? company.settings.logoUrl,
        faviconUrl: payload.faviconUrl ?? company.settings.faviconUrl,
        seoTitle: payload.seoTitle ?? company.settings.seoTitle,
        seoDescription: payload.seoDescription ?? company.settings.seoDescription,
        seoKeywords: payload.seoKeywords ?? company.settings.seoKeywords,
        templateId: payload.templateId ?? company.settings.templateId,
        storefrontTheme: payload.storefrontTheme ?? company.settings.storefrontTheme,
        adminTheme: payload.adminTheme ?? company.settings.adminTheme,
      },
    });
  }

  async updateAssets(companyId: string, payload: { logoUrl?: string; faviconUrl?: string }) {
    return this.prisma.companySettings.update({
      where: { companyId },
      data: {
        logoUrl: payload.logoUrl ?? undefined,
        faviconUrl: payload.faviconUrl ?? undefined,
      },
    });
  }
}
