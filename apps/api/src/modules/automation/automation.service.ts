import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ActionType, FlowStatus, TriggerType } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { EmailTemplatesService } from "../email-templates/email-templates.service";

type FlowSettings = {
  conditions?: any[];
  guardrails?: {
    frequencyCapPerDay?: number;
    quietHours?: { start: string; end: string };
    consentRequired?: boolean;
  };
};

const DEFAULT_SETTINGS: FlowSettings = {
  conditions: [],
  guardrails: {
    frequencyCapPerDay: 1,
    quietHours: { start: "22:00", end: "08:00" },
    consentRequired: true,
  },
};

function getBuenosAiresDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(lookup.year);
  const month = Number(lookup.month);
  const day = Number(lookup.day);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function isWithinQuietHours(now: Date, quiet?: { start: string; end: string }) {
  if (!quiet?.start || !quiet?.end) return false;
  const [startH, startM] = quiet.start.split(":").map((v) => Number(v));
  const [endH, endM] = quiet.end.split(":").map((v) => Number(v));
  if ([startH, startM, endH, endM].some((v) => Number.isNaN(v))) return false;
  const time = now.getHours() * 60 + now.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start === end) return false;
  if (start < end) return time >= start && time < end;
  return time >= start || time < end;
}

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emails: EmailTemplatesService,
  ) {}

  listSegments(companyId: string) {
    return this.prisma.segment.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  createSegment(companyId: string, data: { name: string; description?: string; definition: any }) {
    return this.prisma.segment.create({ data: { companyId, ...data } });
  }

  listCampaigns(companyId: string) {
    return this.prisma.campaign.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  createCampaign(companyId: string, data: { name: string; status?: string; segmentId?: string }) {
    return this.prisma.campaign.create({ data: { companyId, ...data } });
  }

  listTriggers(companyId: string) {
    return this.prisma.trigger.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  async createTrigger(companyId: string, data: { type: TriggerType; config: any }) {
    return this.prisma.trigger.create({ data: { companyId, ...data } });
  }

  async updateTrigger(companyId: string, id: string, data: { type?: TriggerType; config?: any }) {
    const trigger = await this.prisma.trigger.findUnique({ where: { id } });
    if (!trigger || trigger.companyId !== companyId) throw new NotFoundException("Trigger not found");
    return this.prisma.trigger.update({
      where: { id },
      data: {
        type: data.type ?? trigger.type,
        config: data.config ?? trigger.config,
      },
    });
  }

  listFlows(companyId: string) {
    return this.prisma.flow.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { trigger: true, actions: true, campaign: true },
    });
  }

  async getFlow(companyId: string, id: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id },
      include: { trigger: true, actions: true, campaign: true },
    });
    if (!flow || flow.companyId !== companyId) throw new NotFoundException("Flow not found");
    return flow;
  }

  async createFlow(companyId: string, data: { name: string; triggerId: string; campaignId?: string; status?: FlowStatus; settings?: FlowSettings }) {
    const trigger = await this.prisma.trigger.findUnique({ where: { id: data.triggerId } });
    if (!trigger || trigger.companyId !== companyId) throw new BadRequestException("Invalid trigger");
    return this.prisma.flow.create({
      data: {
        companyId,
        name: data.name,
        triggerId: data.triggerId,
        campaignId: data.campaignId ?? undefined,
        status: data.status ?? FlowStatus.DRAFT,
        settings: data.settings ?? DEFAULT_SETTINGS,
      },
      include: { trigger: true, actions: true },
    });
  }

  async updateFlow(companyId: string, id: string, data: { name?: string; triggerId?: string; campaignId?: string; status?: FlowStatus; settings?: FlowSettings }) {
    const flow = await this.prisma.flow.findUnique({ where: { id } });
    if (!flow || flow.companyId !== companyId) throw new NotFoundException("Flow not found");
    if (data.triggerId) {
      const trigger = await this.prisma.trigger.findUnique({ where: { id: data.triggerId } });
      if (!trigger || trigger.companyId !== companyId) throw new BadRequestException("Invalid trigger");
    }
    return this.prisma.flow.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        triggerId: data.triggerId ?? undefined,
        campaignId: data.campaignId ?? undefined,
        status: data.status ?? undefined,
        settings: data.settings ?? undefined,
      },
      include: { trigger: true, actions: true },
    });
  }

  async addAction(companyId: string, flowId: string, data: { type: ActionType; config: any; delayMinutes?: number; position?: number }) {
    const flow = await this.prisma.flow.findUnique({ where: { id: flowId } });
    if (!flow || flow.companyId !== companyId) throw new NotFoundException("Flow not found");
    return this.prisma.action.create({
      data: {
        flowId,
        type: data.type,
        config: data.config,
        delayMinutes: data.delayMinutes ?? 0,
        position: data.position ?? 0,
      },
    });
  }

  async updateAction(companyId: string, actionId: string, data: { config?: any; delayMinutes?: number; position?: number }) {
    const action = await this.prisma.action.findUnique({ where: { id: actionId }, include: { flow: true } });
    if (!action || action.flow.companyId !== companyId) throw new NotFoundException("Action not found");
    return this.prisma.action.update({
      where: { id: actionId },
      data: {
        config: data.config ?? undefined,
        delayMinutes: data.delayMinutes ?? undefined,
        position: data.position ?? undefined,
      },
    });
  }

  async removeAction(companyId: string, actionId: string) {
    const action = await this.prisma.action.findUnique({ where: { id: actionId }, include: { flow: true } });
    if (!action || action.flow.companyId !== companyId) throw new NotFoundException("Action not found");
    return this.prisma.action.delete({ where: { id: actionId } });
  }

  listSuppressions(companyId: string) {
    return this.prisma.suppressionList.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  createSuppression(companyId: string, data: { channel: string; value: string; reason?: string }) {
    return this.prisma.suppressionList.create({ data: { companyId, ...data } });
  }

  private async incrementMetric(flowId: string, companyId: string, field: "sent" | "opened" | "converted", date?: Date) {
    const day = date ?? getBuenosAiresDay();
    await this.prisma.flowMetric.upsert({
      where: { flowId_date: { flowId, date: day } },
      create: { flowId, companyId, date: day, sent: field === "sent" ? 1 : 0, opened: field === "opened" ? 1 : 0, converted: field === "converted" ? 1 : 0 },
      update: { [field]: { increment: 1 } },
    } as any);
  }

  async recordMetric(companyId: string, flowId: string, type: "open" | "conversion", date?: Date) {
    const flow = await this.prisma.flow.findUnique({ where: { id: flowId } });
    if (!flow || flow.companyId !== companyId) throw new NotFoundException("Flow not found");
    await this.incrementMetric(flowId, companyId, type === "open" ? "opened" : "converted", date);
    return { ok: true };
  }

  async getMetrics(companyId: string, flowId: string, from?: Date, to?: Date) {
    const flow = await this.prisma.flow.findUnique({ where: { id: flowId } });
    if (!flow || flow.companyId !== companyId) throw new NotFoundException("Flow not found");
    return this.prisma.flowMetric.findMany({
      where: {
        flowId,
        date: {
          gte: from ?? undefined,
          lte: to ?? undefined,
        },
      },
      orderBy: { date: "asc" },
    });
  }

  private async checkConsent(companyId: string, customerId?: string) {
    if (!customerId) return false;
    const consent = await this.prisma.consentRecord.findFirst({
      where: { companyId, userId: customerId, type: "marketing", accepted: true },
    });
    return Boolean(consent);
  }

  private async checkSuppression(companyId: string, channel: string, recipient: string) {
    const record = await this.prisma.suppressionList.findFirst({
      where: { companyId, channel, value: recipient },
    });
    return Boolean(record);
  }

  private async checkFrequencyCap(flowId: string, channel: string, recipient: string, cap: number) {
    if (!cap || cap <= 0) return false;
    const start = getBuenosAiresDay();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const count = await this.prisma.automationSendLog.count({
      where: {
        flowId,
        channel,
        recipient,
        sentAt: { gte: start, lt: end },
      },
    });
    return count >= cap;
  }

  private getSettings(flow: { settings: any }): FlowSettings {
    return { ...DEFAULT_SETTINGS, ...(flow.settings ?? {}) };
  }

  async runFlowTest(companyId: string, flowId: string, input: { recipient: string; customerId?: string; channel?: string; payload?: any }) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { actions: true, trigger: true, company: { include: { settings: true } } },
    });
    if (!flow || flow.companyId !== companyId) throw new NotFoundException("Flow not found");
    if (flow.status !== FlowStatus.ACTIVE) {
      return { ok: false, reason: "inactive" };
    }

    const settings = this.getSettings(flow);
    const guardrails = settings.guardrails ?? {};

    const nowBA = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }),
    );
    if (isWithinQuietHours(nowBA, guardrails.quietHours)) {
      return { ok: false, reason: "quiet_hours" };
    }

    const consentRequired = guardrails.consentRequired ?? flow.company.settings?.marketingConsentRequired ?? true;
    if (consentRequired) {
      const hasConsent = await this.checkConsent(companyId, input.customerId);
      if (!hasConsent) {
        return { ok: false, reason: "consent_required" };
      }
    }

    const results: Array<{ actionId: string; type: ActionType; status: string; detail?: any }> = [];
    const sortedActions = [...flow.actions].sort((a, b) => a.position - b.position);
    for (const action of sortedActions) {
      const channel = (input.channel ?? action.type).toString().toLowerCase();
      const suppressed = await this.checkSuppression(companyId, channel, input.recipient);
      if (suppressed) {
        results.push({ actionId: action.id, type: action.type, status: "suppressed" });
        continue;
      }

      const cap = guardrails.frequencyCapPerDay ?? 1;
      const capped = await this.checkFrequencyCap(flowId, channel, input.recipient, cap);
      if (capped) {
        results.push({ actionId: action.id, type: action.type, status: "frequency_capped" });
        continue;
      }

      if (action.type === ActionType.EMAIL) {
        const templateId = action.config?.templateId;
        if (!templateId) {
          results.push({ actionId: action.id, type: action.type, status: "missing_template" });
        } else {
          await this.emails.sendTest(templateId, { to: input.recipient });
          results.push({ actionId: action.id, type: action.type, status: "sent" });
        }
      } else if (action.type === ActionType.COUPON) {
        const code = `PROMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        results.push({ actionId: action.id, type: action.type, status: "issued", detail: { code } });
      } else {
        results.push({ actionId: action.id, type: action.type, status: "stubbed" });
      }

      await this.prisma.automationSendLog.create({
        data: {
          companyId,
          flowId,
          channel,
          recipient: input.recipient,
        },
      });
      await this.incrementMetric(flowId, companyId, "sent");
    }

    return { ok: true, results };
  }
}
