import { Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      include: { role: true },
    });
  }

  async get(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async create(companyId: string, dto: CreateUserDto, createdById?: string) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        companyId,
        roleId: dto.roleId,
        email: dto.email,
        name: dto.name,
        passwordHash,
        createdById,
        updatedById: createdById,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateUserDto, updatedById?: string) {
    const existing = await this.get(companyId, id);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    return this.prisma.user.update({
      where: { id: existing.id },
      data: {
        name: dto.name ?? undefined,
        roleId: dto.roleId ?? undefined,
        passwordHash,
        updatedById,
      },
    });
  }

  async remove(companyId: string, id: string, updatedById?: string) {
    await this.get(companyId, id);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById },
    });
  }
}
