import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { validateEvent, type EventEnvelope } from "@erp/shared";
import { IntegrationBuilderService } from "../integration-builder/integration-builder.service";

type QueueItem = EventEnvelope;

type FeatureUsageQuery = {
  companyId?: string;
  from?: string;
  to?: string;
  windowMinutes?: number;
};

@Injectable()
export class EventsService {
  private queue: QueueItem[] = [];
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationBuilder: IntegrationBuilderService,
  ) {
    setInterval(() => {
      this.flush().catch(() => undefined);
    }, 2000).unref();
  }

  enqueue(events: EventEnvelope[]) {
    for (const event of events) {
      this.queue.push(event);
    }
  }

  async flush() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const batch = this.queue.splice(0, 200);
    try {
      for (const event of batch) {
        const validation = validateEvent(event);
        if (!validation.ok) {
          await this.prisma.eventLog.create({
            data: {
              id: event.id,
              companyId: event.companyId ?? null,
              name: event.name ?? "unknown",
              source: event.source ?? "unknown",
              schemaVersion: event.schemaVersion ?? 1,
              occurredAt: new Date(event.occurredAt ?? new Date().toISOString()),
              payload: event.payload ?? {},
              status: "invalid",
              error: validation.error,
            },
          });
          continue;
        }
        await this.prisma.eventLog.create({
          data: {
            id: event.id,
            companyId: event.companyId ?? null,
            name: event.name,
            source: event.source,
            schemaVersion: event.schemaVersion,
            occurredAt: new Date(event.occurredAt),
            payload: event.payload,
            status: "stored",
          },
        });
        await this.integrationBuilder.onEventStored(event).catch(() => undefined);
      }

      const sinkUrl = process.env.EVENT_SINK_URL ?? "";
      if (sinkUrl) {
        await fetch(sinkUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
      }
    } catch (error: unknown) {
      for (const event of batch) {
        await this.prisma.eventLog.create({
          data: {
            id: event.id,
            companyId: event.companyId ?? null,
            name: event.name ?? "unknown",
            source: event.source ?? "unknown",
            schemaVersion: event.schemaVersion ?? 1,
            occurredAt: new Date(event.occurredAt ?? new Date().toISOString()),
            payload: event.payload ?? {},
            status: "failed",
            error: error?.message ?? "sink failed",
          },
        });
      }
    } finally {
      this.processing = false;
    }
  }

  async getStats(companyId?: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const where = companyId
      ? { OR: [{ companyId }, { companyId: null }], receivedAt: { gte: since } }
      : { receivedAt: { gte: since } };
    const total = await this.prisma.eventLog.count({ where });
    const failed = await this.prisma.eventLog.count({ where: { ...where, status: { in: ["failed", "invalid"] } } });
    const events = await this.prisma.eventLog.findMany({
      where,
      select: { occurredAt: true, receivedAt: true },
      take: 500,
      orderBy: { receivedAt: "desc" },
    });
    const lags = events.map((e) => e.receivedAt.getTime() - e.occurredAt.getTime());
    const avgLagMs = lags.length ? Math.round(lags.reduce((a, b) => a + b, 0) / lags.length) : 0;
    return { total1h: total, failed1h: failed, avgLagMs };
  }

  async getFeatureUsage(query: FeatureUsageQuery) {
    const now = new Date();
    const windowMinutesRaw = query.windowMinutes ?? 60;
    const windowMinutes = Number.isFinite(windowMinutesRaw) ? Math.min(Math.max(1, windowMinutesRaw), 24 * 60) : 60;

    const from = query.from ? new Date(query.from) : new Date(now.getTime() - windowMinutes * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() >= to.getTime()) {
      return { ok: false, message: "invalid time range" };
    }

    const companyId = query.companyId ?? null;

    const rows = await this.prisma.$queryRaw<Array<{ feature: string | null; action: string | null; count: bigint }>>`
      SELECT
        (payload->>'feature') as feature,
        (payload->>'action') as action,
        COUNT(*)::bigint as count
      FROM "EventLog"
      WHERE
        "name" = 'FeatureUsageEvent'
        AND "receivedAt" >= ${from}
        AND "receivedAt" < ${to}
        AND (payload->>'feature') IS NOT NULL
        AND (
          ${companyId}::text IS NULL
          OR "companyId" = ${companyId}
          OR "companyId" IS NULL
        )
      GROUP BY 1, 2
      ORDER BY count DESC;
    `;

    const items = rows.map((row) => ({
      feature: row.feature ?? "unknown",
      action: row.action ?? "unknown",
      count: Number(row.count),
    }));

    return {
      ok: true,
      windowFrom: from.toISOString(),
      windowTo: to.toISOString(),
      windowMinutes,
      items,
    };
  }
}
