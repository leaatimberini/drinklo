import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RolePermissions } from "../common/rbac.constants";
import type { SetupInitializeDto } from "./dto/setup.dto";

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const count = await this.prisma.company.count();
    return { initialized: count > 0 };
  }

  async initialize(dto: SetupInitializeDto) {
    const count = await this.prisma.company.count();
    if (count > 0) {
      throw new ConflictException("Setup already completed");
    }

    const permissionCodes = Array.from(
      new Set(Object.values(RolePermissions).flat()),
    );

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
        },
      });

      await tx.companySettings.create({
        data: {
          companyId: company.id,
          brandName: dto.brandName,
          domain: dto.domain,
          logoUrl: dto.logoUrl ?? "https://placehold.co/200x200",
          timezone: "America/Argentina/Buenos_Aires",
          currency: "ARS",
          storefrontTheme: "A",
          adminTheme: "A",
        },
      });

      const branch = await tx.branch.create({
        data: {
          companyId: company.id,
          name: "Principal",
          address: "CABA",
        },
      });

      const permissions = await tx.$transaction(
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

      const roleRecords = await tx.$transaction(
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
        await tx.$transaction(rolePermissionCreates);
      }

      const adminRole = roleMap.get("admin") ?? roleRecords[0];
      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          email: dto.adminEmail,
          name: dto.adminName,
          passwordHash: await bcrypt.hash(dto.adminPassword, 10),
        },
      });

      return { companyId: company.id, adminId: admin.id };
    });
  }
}
