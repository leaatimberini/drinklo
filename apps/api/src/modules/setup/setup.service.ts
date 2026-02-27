import { ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "@erp/db";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RolePermissions } from "../common/rbac.constants";
import type { SetupInitializeDto } from "./dto/setup.dto";
import type { InstallerBootstrapDto } from "./dto/installer-bootstrap.dto";
import { PLAN_CATALOG_DEFAULTS } from "../plans/plan-catalog.constants";
import { buildTrialPeriod } from "../plans/plan-time.util";

type SetupPayload = {
  companyName: string;
  brandName: string;
  domain: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  logoUrl?: string;
  adminTheme: "A" | "B" | "C";
  storefrontTheme: "A" | "B" | "C";
};

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const count = await this.prisma.company.count();
    return { initialized: count > 0 };
  }

  async instanceStatus() {
    return this.status();
  }

  async initialize(dto: SetupInitializeDto) {
    return this.initializeInstance({
      companyName: dto.companyName,
      brandName: dto.brandName,
      domain: dto.domain,
      adminName: dto.adminName,
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      logoUrl: dto.logoUrl,
      adminTheme: "A",
      storefrontTheme: "A",
    });
  }

  async bootstrap(dto: InstallerBootstrapDto) {
    await this.initializeInstance({
      companyName: dto.companyName,
      brandName: dto.companyName,
      domain: this.deriveDomain(dto.companyName, dto.adminEmail),
      adminName: this.deriveAdminName(dto.adminEmail),
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      adminTheme: dto.themeAdmin,
      storefrontTheme: dto.themeStorefront,
    });
    return { ok: true as const };
  }

  private deriveDomain(companyName: string, adminEmail: string) {
    const emailDomain = adminEmail.split("@")[1]?.trim().toLowerCase();
    if (emailDomain && !["localhost", "local"].includes(emailDomain)) {
      return emailDomain;
    }

    const slug = companyName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug ? `${slug}.local` : "empresa.local";
  }

  private deriveAdminName(adminEmail: string) {
    const base = adminEmail.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    if (!base) {
      return "Admin";
    }
    return base
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private async initializeInstance(payload: SetupPayload) {
    const count = await this.prisma.company.count();
    if (count > 0) {
      throw new ConflictException("Setup already completed");
    }

    const permissionCodes = Array.from(
      new Set(Object.values(RolePermissions).flat()),
    );

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of PLAN_CATALOG_DEFAULTS) {
        await tx.planEntitlement.upsert({
          where: { tier: item.tier },
          update: {
            monthlyPriceArs: item.monthlyPriceArs,
            ordersMonth: item.ordersMonth,
            apiCallsMonth: item.apiCallsMonth,
            storageGb: item.storageGb,
            pluginsMax: item.pluginsMax,
            branchesMax: item.branchesMax,
            adminUsersMax: item.adminUsersMax,
            sloTarget: item.sloTarget,
            drFrequency: item.drFrequency,
            supportLevel: item.supportLevel,
          },
          create: { ...item },
        });
      }

      const company = await tx.company.create({
        data: {
          name: payload.companyName,
        },
      });

      await tx.companySettings.create({
        data: {
          companyId: company.id,
          brandName: payload.brandName,
          domain: payload.domain,
          logoUrl: payload.logoUrl ?? "https://placehold.co/200x200",
          timezone: "America/Argentina/Buenos_Aires",
          currency: "ARS",
          storefrontTheme: payload.storefrontTheme,
          adminTheme: payload.adminTheme,
          depotAddress: "CABA",
          depotLat: -34.6037,
          depotLng: -58.3816,
        },
      });

      await tx.branch.create({
        data: {
          companyId: company.id,
          name: "Principal",
          address: "CABA",
        },
      });

      const permissions = await Promise.all(
        permissionCodes.map((code) =>
          tx.permission.create({
            data: {
              companyId: company.id,
              code,
              description: code.replace(":", " "),
            },
          }),
        ),
      );

      const roleRecords = await Promise.all(
        Object.keys(RolePermissions).map((roleName) =>
          tx.role.create({
            data: {
              companyId: company.id,
              name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
            },
          }),
        ),
      );

      const roleMap = new Map(roleRecords.map((role) => [role.name.toLowerCase(), role]));

      const rolePermissionCreates = roleRecords.flatMap((role) => {
        const roleKey = role.name.toLowerCase();
        const allowed = RolePermissions[roleKey as keyof typeof RolePermissions] ?? [];
        return permissions
          .filter((permission) => allowed.includes(permission.code))
          .map((permission) =>
            tx.rolePermission.create({
              data: {
                companyId: company.id,
                roleId: role.id,
                permissionId: permission.id,
              },
            }),
          );
      });

      if (rolePermissionCreates.length > 0) {
        await Promise.all(rolePermissionCreates);
      }

      const adminRole = roleMap.get("admin") ?? roleRecords[0];
      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          email: payload.adminEmail,
          name: payload.adminName,
          passwordHash: await bcrypt.hash(payload.adminPassword, 10),
        },
      });

      const trialPeriod = buildTrialPeriod(new Date(), 30);
      await tx.subscription.create({
        data: {
          companyId: company.id,
          status: "TRIAL_ACTIVE",
          currentTier: "C1",
          currentPeriodStart: trialPeriod.currentPeriodStart,
          currentPeriodEnd: trialPeriod.currentPeriodEnd,
          trialEndAt: trialPeriod.trialEndAt,
        },
      });

      return { companyId: company.id, adminId: admin.id };
    });
  }
}
