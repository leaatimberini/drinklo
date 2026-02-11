import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ThemeTemplates } from "../themes/theme.templates";
import { MockEmailGenerator } from "./email-generator";
import { buildEmailSender } from "./email-sender";
import type { GenerateEmailDto, SendTestEmailDto, UpdateEmailTemplateDto } from "./dto/email-template.dto";
import { LicensingService } from "../licensing/licensing.service";
import { PremiumFeatures } from "../licensing/license.types";
import { EventsService } from "../events/events.service";

@Injectable()
export class EmailTemplatesService {
  private generator = new MockEmailGenerator();

  constructor(
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingService,
    private readonly events: EventsService,
  ) {}

  async list() {
    return this.prisma.emailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async get(id: string) {
    return this.prisma.emailTemplate.findUnique({ where: { id } });
  }

  async generate(dto: GenerateEmailDto) {
    const company = await this.prisma.company.findFirst({ include: { settings: true } });
    if (!company?.settings) {
      throw new Error("Company settings not found");
    }

    await this.licensing.requireFeature(company.id, PremiumFeatures.EMAIL_AI);

    const themeId = company.settings.adminTheme as keyof typeof ThemeTemplates;
    const theme = ThemeTemplates[themeId] ?? ThemeTemplates.A;

    const generated = await this.generator.generate({
      type: dto.type,
      objective: dto.objective,
      brandTone: company.settings.brandTone ?? "Profesional",
      logoUrl: company.settings.logoUrl,
      theme,
    });

    const latest = await this.prisma.emailTemplate.findFirst({
      where: { type: dto.type },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.emailTemplate.create({
      data: {
        companyId: company.id,
        type: dto.type,
        subject: generated.subject,
        body: generated.body,
        version,
        status: "DRAFT",
      },
    });
  }

  async update(id: string, dto: UpdateEmailTemplateDto) {
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        subject: dto.subject ?? undefined,
        body: dto.body ?? undefined,
      },
    });
  }

  async approve(id: string) {
    return this.prisma.emailTemplate.update({
      where: { id },
      data: { status: "APPROVED" },
    });
  }

  async sendTest(id: string, dto: SendTestEmailDto) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new Error("Template not found");
    }
    const sender = buildEmailSender();
    await sender.send({ to: dto.to, subject: template.subject, html: template.body });
    this.events.enqueue([
      {
        id: randomUUID(),
        name: "EmailSent",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "api",
        companyId: template.companyId,
        subjectId: template.id,
        payload: {
          templateId: template.id,
          to: dto.to,
          subject: template.subject,
        },
      },
    ]);
    return { ok: true };
  }
}
