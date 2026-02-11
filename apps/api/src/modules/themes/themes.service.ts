import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ThemeId, ThemeTokens } from "./theme.templates";
import { ThemeTemplates } from "./theme.templates";
import type { UpdateThemeDto } from "./dto/update-theme.dto";

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTheme(themeId: ThemeId): ThemeTokens {
    return ThemeTemplates[themeId] ?? ThemeTemplates.A;
  }

  async getActive() {
    const company = await this.prisma.company.findFirst({
      include: { settings: true },
    });
    if (!company?.settings) {
      throw new NotFoundException("Company settings not found");
    }

    const { adminTheme, storefrontTheme } = company.settings;

    return {
      admin: this.resolveTheme(adminTheme as ThemeId),
      storefront: this.resolveTheme(storefrontTheme as ThemeId),
      templates: Object.values(ThemeTemplates).map((theme) => ({
        id: theme.id,
        name: theme.name,
      })),
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
