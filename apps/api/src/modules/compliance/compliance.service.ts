import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateComplianceDto, ConsentDto } from "./dto/compliance.dto";

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings() {
    const company = await this.prisma.company.findFirst({ include: { settings: true } });
    if (!company?.settings) {
      return {
        ageGateMode: "DISABLED",
        termsUrl: null,
        privacyUrl: null,
        cookiesUrl: null,
        marketingConsentRequired: false,
        hasAlcoholicProducts: false,
      };
    }

    const hasAlcoholicProducts =
      (await this.prisma.product.count({ where: { companyId: company.id, isAlcoholic: true, deletedAt: null } })) > 0;

    return {
      ageGateMode: company.settings.ageGateMode,
      termsUrl: company.settings.termsUrl,
      privacyUrl: company.settings.privacyUrl,
      cookiesUrl: company.settings.cookiesUrl,
      marketingConsentRequired: company.settings.marketingConsentRequired,
      hasAlcoholicProducts,
    };
  }

  async getAdminSettings(companyId: string) {
    return this.prisma.companySettings.findUnique({ where: { companyId } });
  }

  async updateAdminSettings(companyId: string, dto: UpdateComplianceDto) {
    return this.prisma.companySettings.update({
      where: { companyId },
      data: {
        ageGateMode: dto.ageGateMode ?? undefined,
        termsUrl: dto.termsUrl ?? undefined,
        privacyUrl: dto.privacyUrl ?? undefined,
        cookiesUrl: dto.cookiesUrl ?? undefined,
        marketingConsentRequired: dto.marketingConsentRequired ?? undefined,
      },
    });
  }

  async recordConsent(companyId: string, payload: ConsentDto, ipAddress?: string, userId?: string) {
    return this.prisma.consentRecord.create({
      data: {
        companyId,
        type: payload.type,
        accepted: payload.accepted,
        ipAddress,
        userId: userId ?? null,
      },
    });
  }
}
