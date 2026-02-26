import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Subscription } from "@erp/db";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- optional runtime import used only when email notifications are triggered
import { createRequire } from "node:module";
import { PrismaService } from "../prisma/prisma.service";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";
import { BotAuditService } from "../bot-audit/bot-audit.service";
import { addDaysPreservingBuenosAiresWallClock } from "../plans/plan-time.util";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_DAYS = 7;
const QUEUE_NAME = "subscription-lifecycle";
const requireModule = createRequire(__filename);

type LifecycleJobName = "trial-expirer" | "grace-expirer" | "past-due-handler" | "trial-reminder-notifier";

type TransitionResult = {
  scanned: number;
  transitioned: number;
  skipped: number;
};

@Injectable()
export class SubscriptionLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);
  private queue?: Queue;
  private worker?: Worker;
  private connection?: IORedis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ImmutableAuditService,
    private readonly botAudit: BotAuditService,
  ) {}

  async onModuleInit() {
    if ((process.env.SUBSCRIPTION_LIFECYCLE_CRON_ENABLED ?? "true").toLowerCase() === "false") {
      return;
    }
    const redisUrl = process.env.REDIS_URL ?? "";
    if (!redisUrl) return;

    this.connection = new IORedis(redisUrl);
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection as unknown });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const now = job.data?.now ? new Date(job.data.now) : new Date();
        switch (job.name as LifecycleJobName) {
          case "trial-expirer":
            return this.runTrialExpirer(now, `job:${job.name}`);
          case "grace-expirer":
            return this.runGraceExpirer(now, `job:${job.name}`);
          case "past-due-handler":
            return this.runPastDueHandler(now, `job:${job.name}`);
          case "trial-reminder-notifier":
            return this.runTrialReminderNotifier(now, `job:${job.name}`);
          default:
            return { ok: false, reason: "unknown_job" };
        }
      },
      { connection: this.connection as unknown },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private graceDays() {
    return Number(process.env.SUBSCRIPTION_LIFECYCLE_GRACE_DAYS ?? DEFAULT_GRACE_DAYS);
  }

  private async enqueueJob(name: LifecycleJobName, cadence: "hourly" | "daily") {
    const now = new Date();
    if (!this.queue) {
      if (name === "trial-expirer") return this.runTrialExpirer(now, `cron:${cadence}`);
      if (name === "grace-expirer") return this.runGraceExpirer(now, `cron:${cadence}`);
      if (name === "past-due-handler") return this.runPastDueHandler(now, `cron:${cadence}`);
      return this.runTrialReminderNotifier(now, `cron:${cadence}`);
    }
    const jobId =
      cadence === "hourly"
        ? `${name}:${now.toISOString().slice(0, 13)}`
        : `${name}:${now.toISOString().slice(0, 10)}`;
    await this.queue.add(name, { now: now.toISOString() }, { jobId, removeOnComplete: true, removeOnFail: 100 });
    return { enqueued: true, jobId };
  }

  @Cron(process.env.SUBSCRIPTION_LIFECYCLE_HOURLY_CRON ?? "7 * * * *")
  async enqueueHourlyLifecycle() {
    if ((process.env.SUBSCRIPTION_LIFECYCLE_CRON_ENABLED ?? "true").toLowerCase() === "false") return;
    for (const job of ["trial-expirer", "past-due-handler", "grace-expirer"] as const) {
      try {
        await this.enqueueJob(job, "hourly");
      } catch (error) {
        this.logger.warn(`failed to enqueue ${job}: ${(error as Error).message}`);
      }
    }
  }

  @Cron(process.env.SUBSCRIPTION_LIFECYCLE_DAILY_CRON ?? "15 10 * * *")
  async enqueueDailyLifecycle() {
    if ((process.env.SUBSCRIPTION_LIFECYCLE_CRON_ENABLED ?? "true").toLowerCase() === "false") return;
    try {
      await this.enqueueJob("trial-reminder-notifier", "daily");
    } catch (error) {
      this.logger.warn(`failed to enqueue trial-reminder-notifier: ${(error as Error).message}`);
    }
  }

  async listRecentNotifications(companyId: string, limit = 20) {
    return this.prisma.subscriptionLifecycleNotification.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  async runJob(job: LifecycleJobName, now = new Date(), actor = "manual") {
    if (job === "trial-expirer") return this.runTrialExpirer(now, actor);
    if (job === "grace-expirer") return this.runGraceExpirer(now, actor);
    if (job === "past-due-handler") return this.runPastDueHandler(now, actor);
    return this.runTrialReminderNotifier(now, actor);
  }

  async runTrialExpirer(now = new Date(), actor = "job:trial-expirer"): Promise<TransitionResult> {
    const candidates = await this.prisma.subscription.findMany({
      where: { status: "TRIAL_ACTIVE", trialEndAt: { lte: now } },
      select: {
        id: true,
        companyId: true,
        status: true,
        currentTier: true,
        nextTier: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndAt: true,
        graceEndAt: true,
        lastPaymentAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let transitioned = 0;
    for (const subscription of candidates) {
      const graceEndAt =
        subscription.graceEndAt ??
        addDaysPreservingBuenosAiresWallClock(subscription.trialEndAt ?? now, this.graceDays());
      const updated = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, status: "TRIAL_ACTIVE", trialEndAt: { lte: now } },
        data: { status: "GRACE", graceEndAt },
      });
      if (updated.count === 0) continue;
      transitioned += 1;
      await this.recordTransitionAudit(subscription.companyId, subscription.id, "TRIAL_ACTIVE", "GRACE", actor, {
        trialEndAt: subscription.trialEndAt?.toISOString() ?? null,
        graceEndAt: graceEndAt.toISOString(),
      });
      const transitionedSub = { ...subscription, status: "GRACE", graceEndAt } as Subscription;
      await this.notifyTransition(transitionedSub, "trial_expired", actor, {
        graceEndAt: graceEndAt.toISOString(),
      });
    }

    return { scanned: candidates.length, transitioned, skipped: candidates.length - transitioned };
  }

  async runGraceExpirer(now = new Date(), actor = "job:grace-expirer"): Promise<TransitionResult> {
    const candidates = await this.prisma.subscription.findMany({
      where: { status: "GRACE", graceEndAt: { lte: now } },
      select: {
        id: true,
        companyId: true,
        status: true,
        currentTier: true,
        nextTier: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndAt: true,
        graceEndAt: true,
        lastPaymentAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let transitioned = 0;
    for (const subscription of candidates) {
      const updated = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, status: "GRACE", graceEndAt: { lte: now } },
        data: { status: "RESTRICTED" },
      });
      if (updated.count === 0) continue;
      transitioned += 1;
      await this.recordTransitionAudit(subscription.companyId, subscription.id, "GRACE", "RESTRICTED", actor, {
        graceEndAt: subscription.graceEndAt?.toISOString() ?? null,
      });
      const transitionedSub = { ...subscription, status: "RESTRICTED" } as Subscription;
      await this.notifyTransition(transitionedSub, "restricted_started", actor, {});
    }

    return { scanned: candidates.length, transitioned, skipped: candidates.length - transitioned };
  }

  async runPastDueHandler(now = new Date(), actor = "job:past-due-handler") {
    const toPastDue = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE_PAID",
        currentPeriodEnd: { lte: now },
      },
      select: {
        id: true,
        companyId: true,
        status: true,
        currentTier: true,
        nextTier: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndAt: true,
        graceEndAt: true,
        lastPaymentAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let pastDueTransitioned = 0;
    for (const subscription of toPastDue.filter((s) => !s.lastPaymentAt || s.lastPaymentAt < s.currentPeriodEnd)) {
      const graceEndAt =
        subscription.graceEndAt ??
        addDaysPreservingBuenosAiresWallClock(subscription.currentPeriodEnd, this.graceDays());
      const updated = await this.prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          status: "ACTIVE_PAID",
          currentPeriodEnd: { lte: now },
          OR: [{ lastPaymentAt: null }, { lastPaymentAt: { lt: subscription.currentPeriodEnd } }],
        },
        data: { status: "PAST_DUE", graceEndAt },
      });
      if (updated.count === 0) continue;
      pastDueTransitioned += 1;
      await this.recordTransitionAudit(subscription.companyId, subscription.id, "ACTIVE_PAID", "PAST_DUE", actor, {
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        graceEndAt: graceEndAt.toISOString(),
      });
      const transitionedSub = { ...subscription, status: "PAST_DUE", graceEndAt } as Subscription;
      await this.notifyTransition(transitionedSub, "past_due_started", actor, {
        graceEndAt: graceEndAt.toISOString(),
      });
    }

    const toGrace = await this.prisma.subscription.findMany({
      where: { status: "PAST_DUE" },
      select: {
        id: true,
        companyId: true,
        status: true,
        currentTier: true,
        nextTier: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndAt: true,
        graceEndAt: true,
        lastPaymentAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let graceTransitioned = 0;
    for (const subscription of toGrace) {
      const graceEndAt =
        subscription.graceEndAt ??
        addDaysPreservingBuenosAiresWallClock(subscription.currentPeriodEnd, this.graceDays());
      const updated = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, status: "PAST_DUE" },
        data: { status: "GRACE", graceEndAt },
      });
      if (updated.count === 0) continue;
      graceTransitioned += 1;
      await this.recordTransitionAudit(subscription.companyId, subscription.id, "PAST_DUE", "GRACE", actor, {
        graceEndAt: graceEndAt.toISOString(),
      });
      const transitionedSub = { ...subscription, status: "GRACE", graceEndAt } as Subscription;
      await this.notifyTransition(transitionedSub, "grace_started", actor, {
        graceEndAt: graceEndAt.toISOString(),
      });
    }

    return {
      activePaidScanned: toPastDue.length,
      pastDueTransitioned,
      pastDueScanned: toGrace.length,
      graceTransitioned,
    };
  }

  async runTrialReminderNotifier(now = new Date(), actor = "job:trial-reminder-notifier") {
    const windowEnd = new Date(now.getTime() + 8 * DAY_MS);
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: "TRIAL_ACTIVE",
        trialEndAt: { gt: now, lte: windowEnd },
      },
      select: {
        id: true,
        companyId: true,
        status: true,
        currentTier: true,
        nextTier: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndAt: true,
        graceEndAt: true,
        lastPaymentAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let sent = 0;
    let scanned = 0;
    for (const subscription of subscriptions) {
      if (!subscription.trialEndAt) continue;
      scanned += 1;
      const daysLeft = this.daysUntilByBuenosAiresDate(subscription.trialEndAt, now);
      if (![7, 3, 1].includes(daysLeft)) continue;
      const changed = await this.notifyAdmins(subscription as Subscription, {
        kind: `trial_reminder_t${daysLeft}`,
        actor,
        dedupeSuffix: `${this.isoDate(subscription.trialEndAt)}:${daysLeft}`,
        subject: `Trial finaliza en ${daysLeft} dia(s)`,
        html: `<p>El trial de la instancia finaliza en <strong>${daysLeft}</strong> dia(s).</p>`,
        payload: {
          type: "trial_reminder",
          daysLeft,
          trialEndAt: subscription.trialEndAt.toISOString(),
        },
      });
      if (changed > 0) sent += 1;
    }

    return { scanned, notified: sent };
  }

  private daysUntilByBuenosAiresDate(target: Date, now: Date) {
    const toKey = (d: Date) => {
      const adjusted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return Date.UTC(adjusted.getUTCFullYear(), adjusted.getUTCMonth(), adjusted.getUTCDate());
    };
    return Math.round((toKey(target) - toKey(now)) / DAY_MS);
  }

  private isoDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private async recordTransitionAudit(
    companyId: string,
    subscriptionId: string,
    fromStatus: string,
    toStatus: string,
    actor: string,
    payload: Record<string, unknown>,
  ) {
    await this.audit.append({
      companyId,
      category: "billing",
      action: "subscription.lifecycle.transition",
      method: "JOB",
      route: `/jobs/subscription-lifecycle/${actor}`,
      statusCode: 200,
      actorUserId: null,
      actorRole: "system",
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      payload: {
        fromStatus,
        toStatus,
        actor,
        occurredAt: new Date().toISOString(),
        ...payload,
      },
    });
  }

  private async notifyTransition(
    subscription: Subscription,
    kind: "trial_expired" | "past_due_started" | "grace_started" | "restricted_started",
    actor: string,
    extraPayload: Record<string, unknown>,
  ) {
    const messages = {
      trial_expired: {
        subject: "Trial expirado - periodo de gracia activo",
        html: `<p>El trial expiro y la suscripcion paso a <strong>GRACE</strong>.</p>`,
      },
      past_due_started: {
        subject: "Suscripcion en mora (PAST_DUE)",
        html: `<p>La suscripcion paso a <strong>PAST_DUE</strong>.</p>`,
      },
      grace_started: {
        subject: "Periodo de gracia activo",
        html: `<p>La suscripcion paso a <strong>GRACE</strong>.</p>`,
      },
      restricted_started: {
        subject: "Suscripcion restringida",
        html: `<p>La suscripcion paso a <strong>RESTRICTED</strong>. No se borran datos; se limitan capacidades.</p>`,
      },
    }[kind];

    return this.notifyAdmins(subscription, {
      kind,
      actor,
      dedupeSuffix: kind,
      subject: messages.subject,
      html: messages.html,
      payload: {
        type: "transition",
        kind,
        status: subscription.status,
        ...extraPayload,
      },
    });
  }

  private async notifyAdmins(
    subscription: Pick<Subscription, "id" | "companyId" | "status" | "currentTier" | "trialEndAt" | "graceEndAt">,
    input: {
      kind: string;
      actor: string;
      dedupeSuffix: string;
      subject: string;
      html: string;
      payload: Record<string, unknown>;
    },
  ) {
    let sent = 0;
    const admins = await this.prisma.user.findMany({
      where: {
        companyId: subscription.companyId,
        deletedAt: null,
        role: { name: { equals: "Admin", mode: "insensitive" } },
      },
      select: { id: true, email: true },
    });

    for (const admin of admins) {
      const dedupeKey = `sub:${subscription.id}:email:${input.kind}:${input.dedupeSuffix}:${admin.email.toLowerCase()}`;
      const reserved = await this.reserveNotification({
        companyId: subscription.companyId,
        subscriptionId: subscription.id,
        channel: "EMAIL",
        kind: input.kind,
        dedupeKey,
        recipient: admin.email,
        payload: { actor: input.actor, ...input.payload },
      });
      if (!reserved) continue;
      try {
        await this.sendEmail(admin.email, input.subject, input.html);
        await this.markNotificationSent(dedupeKey);
        sent += 1;
      } catch (error) {
        await this.markNotificationFailed(dedupeKey, (error as Error).message);
      }
    }

    const chatIds = (process.env.SUBSCRIPTION_ALERT_TELEGRAM_CHAT_IDS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const chatId of chatIds) {
      const dedupeKey = `sub:${subscription.id}:telegram:${input.kind}:${input.dedupeSuffix}:${chatId}`;
      const reserved = await this.reserveNotification({
        companyId: subscription.companyId,
        subscriptionId: subscription.id,
        channel: "TELEGRAM",
        kind: input.kind,
        dedupeKey,
        recipient: chatId,
        payload: { actor: input.actor, ...input.payload },
      });
      if (!reserved) continue;
      const text = `${input.subject}\nCompany: ${subscription.companyId}\nTier: ${subscription.currentTier}\nEstado: ${subscription.status}`;
      try {
        await this.sendTelegram(chatId, text);
        await this.botAudit.record({
          companyId: subscription.companyId,
          chatId,
          command: "/subscription_lifecycle_notify",
          status: "sent",
          result: { kind: input.kind, actor: input.actor },
        });
        await this.markNotificationSent(dedupeKey);
        sent += 1;
      } catch (error) {
        await this.markNotificationFailed(dedupeKey, (error as Error).message);
      }
    }

    const bannerKey = `sub:${subscription.id}:banner:${input.kind}:${input.dedupeSuffix}`;
    const reservedBanner = await this.reserveNotification({
      companyId: subscription.companyId,
      subscriptionId: subscription.id,
      channel: "ADMIN_BANNER",
      kind: input.kind,
      dedupeKey: bannerKey,
      recipient: null,
      payload: { actor: input.actor, ...input.payload, subject: input.subject },
    });
    if (reservedBanner) {
      await this.markNotificationSent(bannerKey);
      sent += 1;
    }

    return sent;
  }

  protected async sendEmail(to: string, subject: string, html: string) {
    const { buildEmailSender } = requireModule("../email-templates/email-sender") as {
      buildEmailSender: () => { send(input: { to: string; subject: string; html: string }): Promise<void> };
    };
    const sender = buildEmailSender();
    await sender.send({ to, subject, html });
  }

  protected async sendTelegram(chatId: string, text: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN missing");
    }
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      throw new Error(`telegram_send_failed_${response.status}`);
    }
  }

  private async reserveNotification(input: {
    companyId: string;
    subscriptionId: string;
    channel: "EMAIL" | "TELEGRAM" | "ADMIN_BANNER";
    kind: string;
    dedupeKey: string;
    recipient: string | null;
    payload: unknown;
  }) {
    try {
      const result = await this.prisma.subscriptionLifecycleNotification.createMany({
        data: [
          {
            companyId: input.companyId,
            subscriptionId: input.subscriptionId,
            channel: input.channel,
            kind: input.kind,
            dedupeKey: input.dedupeKey,
            recipient: input.recipient,
            payload: input.payload,
            status: "SKIPPED",
          },
        ],
        skipDuplicates: true,
      });
      return result.count > 0;
    } catch {
      return false;
    }
  }

  private markNotificationSent(dedupeKey: string) {
    return this.prisma.subscriptionLifecycleNotification.updateMany({
      where: { dedupeKey },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
  }

  private markNotificationFailed(dedupeKey: string, message: string) {
    return this.prisma.subscriptionLifecycleNotification.updateMany({
      where: { dedupeKey },
      data: { status: "FAILED", error: message.slice(0, 1000) },
    });
  }
}
