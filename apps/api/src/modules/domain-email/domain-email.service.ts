import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { EmailEventDto, UpsertEmailDomainDto } from "./dto/domain-email.dto";

@Injectable()
export class DomainEmailService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    return this.prisma.emailDomain.findUnique({ where: { companyId } });
  }

  async upsert(companyId: string, dto: UpsertEmailDomainDto) {
    return this.prisma.emailDomain.upsert({
      where: { companyId },
      update: {
        providerType: dto.providerType,
        providerName: dto.providerName ?? null,
        domain: dto.domain ?? null,
        spfValue: dto.spfValue ?? null,
        dkimSelector: dto.dkimSelector ?? null,
        dkimValue: dto.dkimValue ?? null,
        dmarcValue: dto.dmarcValue ?? null,
      },
      create: {
        companyId,
        providerType: dto.providerType,
        providerName: dto.providerName ?? null,
        domain: dto.domain ?? null,
        spfValue: dto.spfValue ?? null,
        dkimSelector: dto.dkimSelector ?? null,
        dkimValue: dto.dkimValue ?? null,
        dmarcValue: dto.dmarcValue ?? null,
      },
    });
  }

  async confirm(companyId: string, confirmed: boolean, userId?: string) {
    const existing = await this.prisma.emailDomain.findUnique({ where: { companyId } });
    if (!existing) {
      return this.prisma.emailDomain.create({
        data: {
          companyId,
          providerType: "SMTP",
          status: confirmed ? "VERIFIED" : "PENDING",
          verifiedAt: confirmed ? new Date() : null,
          verifiedById: confirmed ? userId ?? null : null,
        },
      });
    }

    return this.prisma.emailDomain.update({
      where: { companyId },
      data: {
        verifiedAt: confirmed ? new Date() : null,
        verifiedById: confirmed ? userId ?? null : null,
        status: confirmed ? "VERIFIED" : "PENDING",
      },
    });
  }

  async recordEvent(companyId: string, dto: EmailEventDto, payload: unknown) {
    return this.prisma.emailEventLog.create({
      data: {
        companyId,
        provider: dto.provider ?? "unknown",
        type: dto.type,
        recipient: dto.recipient ?? null,
        messageId: dto.messageId ?? null,
        payload,
      },
    });
  }
}
