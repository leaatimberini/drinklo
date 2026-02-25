import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ThemeId, ThemeTokens } from "./theme.templates";
import { ThemeTemplates } from "./theme.templates";
import type { UpdateThemeDto } from "./dto/update-theme.dto";
import { buildRestrictedCapabilities, normalizeRestrictedModeVariant } from "../plans/subscription-lifecycle.policy";

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTheme(themeId: ThemeId): ThemeTokens {
    return ThemeTemplates[themeId] ?? ThemeTemplates.A;
  }

  async getActive() {
    const company = await this.prisma.company.findFirst({
      include: {
        settings: true,
        subscription: {
          select: { status: true, currentTier: true, nextTier: true, currentPeriodEnd: true, trialEndAt: true, graceEndAt: true },
        },
      },
    });
    if (!company?.settings) {
      throw new NotFoundException("Company settings not found");
    }

    const { adminTheme, storefrontTheme } = company.settings;

    const restrictedVariant = normalizeRestrictedModeVariant(company.settings.restrictedModeVariant);
    const subscriptionStatus = company.subscription?.status ?? "UNKNOWN";
    const isRestricted = subscriptionStatus === "RESTRICTED";
    return {
      admin: this.resolveTheme(adminTheme as ThemeId),
      storefront: this.resolveTheme(storefrontTheme as ThemeId),
      templates: Object.values(ThemeTemplates).map((theme) => ({
        id: theme.id,
        name: theme.name,
      })),
      runtime: {
        subscription: company.subscription ?? null,
        restricted: {
          enabled: isRestricted,
          variant: restrictedVariant,
          policy: buildRestrictedCapabilities(restrictedVariant),
          storefrontCheckoutBlocked: isRestricted && restrictedVariant === "CATALOG_ONLY",
        },
      },
    };
  }

  async updateThemes(dto: UpdateThemeDto) {
    const company = await this.prisma.company.findFirst({ include: { settings: true } });
    if (!company?.settings) {
      throw new NotFoundException("Company settings not found");
    }

    const updated = await this.prisma.companySettings.update({
      where: { companyId: company.id },
      data: {
        adminTheme: dto.adminTheme ?? undefined,
        storefrontTheme: dto.storefrontTheme ?? undefined,
      },
    });

    return {
      admin: this.resolveTheme(updated.adminTheme as ThemeId),
      storefront: this.resolveTheme(updated.storefrontTheme as ThemeId),
    };
  }
}
