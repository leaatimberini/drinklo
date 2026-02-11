import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RetentionPolicyDto } from "./dto/privacy.dto";

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async exportCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      include: { addresses: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        deletedAt: customer.deletedAt,
      },
      addresses: customer.addresses,
    };
  }

  async anonymizeCustomer(companyId: string, customerId: string, requestedById?: string, notes?: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const anonName = `Anon-${customer.id.slice(0, 8)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { customerId: customer.id, companyId },
        data: {
          line1: "",
          line2: null,
          city: "",
          state: null,
          postalCode: "",
          country: "",
          deletedAt: new Date(),
        },
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          name: anonName,
          email: null,
          phone: null,
          deletedAt: new Date(),
        },
      });

      await tx.privacyRequest.create({
        data: {
          companyId,
          customerId: customer.id,
          type: "ANONYMIZE",
          status: "DONE",
          requestedById: requestedById ?? null,
          notes: notes ?? null,
        },
      });
    });

    return { ok: true };
  }

  async getRetentionPolicy(companyId: string) {
    return this.prisma.companySettings.findUnique({ where: { companyId } });
  }

  async updateRetentionPolicy(companyId: string, dto: RetentionPolicyDto) {
    return this.prisma.companySettings.update({
      where: { companyId },
      data: {
        retentionLogsDays: dto.retentionLogsDays ?? undefined,
        retentionOrdersDays: dto.retentionOrdersDays ?? undefined,
        retentionMarketingDays: dto.retentionMarketingDays ?? undefined,
      },
    });
  }
}
