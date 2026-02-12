import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BotAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(payload: {
    companyId?: string;
    adminId?: string;
    chatId: string;
    command: string;
    args?: string;
    status: string;
    result?: any;
  }) {
    return this.prisma.botCommandLog.create({
      data: {
        companyId: payload.companyId ?? null,
        adminId: payload.adminId ?? null,
        chatId: payload.chatId,
        command: payload.command,
        args: payload.args ?? null,
        status: payload.status,
        result: payload.result ?? null,
      },
    });
  }
}
