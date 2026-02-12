import { Injectable, NotFoundException } from "@nestjs/common";
import { GovernanceEntity } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type { RetentionPolicyDto } from "./dto/privacy.dto";
import { DataGovernanceService } from "../data-governance/data-governance.service";

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly governance: DataGovernanceService,
  ) {}

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
    const effective = await this.governance.getEffectivePolicies(companyId);
    const entityMap = new Map(effective.entities.map((item) => [item.entity, item.retentionDays]));
    return {
      retentionLogsDays: entityMap.get(GovernanceEntity.LOGS) ?? 90,
      retentionOrdersDays: entityMap.get(GovernanceEntity.ORDERS) ?? 365,
      retentionMarketingDays: entityMap.get(GovernanceEntity.MARKETING) ?? 365,
      source: "data-governance",
      currentPlan: effective.currentPlan,
    };
  }

  async updateRetentionPolicy(companyId: string, dto: RetentionPolicyDto) {
    const items = [];
    if (dto.retentionOrdersDays) {
      items.push({ plan: "pro" as const, entity: GovernanceEntity.ORDERS, retentionDays: dto.retentionOrdersDays });
    }
    if (dto.retentionLogsDays) {
      items.push({ plan: "pro" as const, entity: GovernanceEntity.LOGS, retentionDays: dto.retentionLogsDays });
      items.push({ plan: "pro" as const, entity: GovernanceEntity.EVENTS, retentionDays: dto.retentionLogsDays });
    }
    if (dto.retentionMarketingDays) {
      items.push({ plan: "pro" as const, entity: GovernanceEntity.MARKETING, retentionDays: dto.retentionMarketingDays });
    }
    if (items.length > 0) {
      await this.governance.upsertPolicies(companyId, { items });
    }
    return this.getRetentionPolicy(companyId);
  }
}
