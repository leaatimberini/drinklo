import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { OpsService } from "../ops/ops.service";

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ops: OpsService,
  ) {}

  async listTickets(companyId: string, customerId: string) {
    return this.prisma.supportTicket.findMany({
      where: { companyId, customerId },
      orderBy: { updatedAt: "desc" },
      include: { attachments: true },
    });
  }

  async getTicket(companyId: string, customerId: string, id: string) {
    return this.prisma.supportTicket.findFirst({
      where: { id, companyId, customerId },
      include: { messages: true, attachments: true },
    });
  }

  async createTicket(companyId: string, customerId: string, subject: string, message: string, priority?: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        companyId,
        customerId,
        subject,
        priority: priority ?? "NORMAL",
        messages: {
          create: {
            authorType: "CUSTOMER",
            authorId: customerId,
            message,
          },
        },
      },
    });
    return ticket;
  }

  async addMessage(companyId: string, customerId: string, ticketId: string, message: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, companyId, customerId },
    });
    if (!ticket) return null;

    await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorType: "CUSTOMER",
        authorId: customerId,
        message,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return true;
  }

  async attachDiagnostic(companyId: string, customerId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, companyId, customerId },
    });
    if (!ticket) return null;

    const bundle = await this.ops.getDiagnosticBundle(50, companyId);
    const payload = Buffer.from(JSON.stringify(bundle, null, 2));
    const key = `support/diagnostics/${companyId}/${ticketId}/${Date.now()}.json`;
    await this.storage.put(key, payload, "application/json");

    const attachment = await this.prisma.supportTicketAttachment.create({
      data: {
        ticketId,
        key,
        contentType: "application/json",
        sizeBytes: payload.length,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        diagnosticsKey: key,
        diagnosticsMeta: { sizeBytes: payload.length },
        updatedAt: new Date(),
      },
    });

    return attachment;
  }

  async listIncidents(companyId: string) {
    return this.prisma.supportIncident.findMany({
      where: { companyId },
      orderBy: { startedAt: "desc" },
    });
  }

  async listIntegrations(companyId: string) {
    return this.prisma.integrationHealthLog.findMany({
      where: { companyId },
      orderBy: { checkedAt: "desc" },
      distinct: ["provider"],
    });
  }
}
