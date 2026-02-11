import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.customer.findMany({ where: { companyId, deletedAt: null } });
  }

  async get(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  create(companyId: string, dto: CreateCustomerDto, createdById?: string) {
    return this.prisma.customer.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        createdById,
        updatedById: createdById,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto, updatedById?: string) {
    await this.get(companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        updatedById,
      },
    });
  }

  async remove(companyId: string, id: string, updatedById?: string) {
    await this.get(companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById },
    });
  }
}
