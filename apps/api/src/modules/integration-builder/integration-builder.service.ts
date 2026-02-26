import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  IntegrationConnectorAuthMode,
  IntegrationConnectorDeliveryStatus,
  IntegrationConnectorDestinationType,
  Prisma,
} from "@erp/db";
import { ConfigService } from "@nestjs/config";
import type { EventEnvelope } from "@erp/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SecretsService } from "../secrets/secrets.service";
import type {
  ConnectorSecretRotateDto,
  DeliveryLogsQueryDto,
  IntegrationBuilderPreviewDto,
  UpsertIntegrationConnectorsDto,
} from "./dto/integration-builder.dto";

function getPath(obj: unknown, path: string): unknown {
  const normalized = path.startsWith("$.") ? path.slice(2) : path.startsWith("$") ? path.slice(1) : path;
  if (!normalized) return obj;
  const segments = normalized.split(".").filter(Boolean);
  let curr = obj;
  for (const seg of segments) {
    if (curr == null) return null;
    curr = curr[seg];
  }
  return curr ?? null;
}

function interpolateString(template: string, ctx: { event: unknown; secret: unknown }) {
  if (template.startsWith("$.") || template === "$") {
    return getPath(ctx.event, template);
  }
  return template.replace(/\{\{\s*(event|secret)\.([^}]+)\s*\}\}/g, (_, root, path) => {
    const value = getPath(root === "event" ? ctx.event : ctx.secret, `$."${String(path).replace(/"/g, "")}"`);
    const direct = getPath(root === "event" ? ctx.event : ctx.secret, `$.${String(path).trim()}`);
    const resolved = direct ?? value;
    return resolved == null ? "" : String(resolved);
  });
}

export function applyJsonMapping(template: unknown, ctx: { event: unknown; secret?: unknown }): unknown {
  if (template === null || template === undefined) return null;
  if (typeof template === "string") return interpolateString(template, { event: ctx.event, secret: ctx.secret ?? {} });
  if (Array.isArray(template)) return template.map((item) => applyJsonMapping(item, ctx));
  if (typeof template === "object") {
    return Object.fromEntries(
      Object.entries(template).map(([key, value]) => [key, applyJsonMapping(value, ctx)]),
    );
  }
  return template;
}

export function computeRetryBackoffMs(baseMs: number, attemptNumber: number) {
  const safeBase = Math.max(100, Math.min(baseMs || 1000, 60_000));
  const exp = Math.max(0, Math.min(attemptNumber - 1, 8));
  return safeBase * 2 ** exp;
}

@Injectable()
export class IntegrationBuilderService implements OnModuleDestroy {
  private readonly logger = new Logger(IntegrationBuilderService.name);
  private readonly timer: NodeJS.Timeout;
  private readonly controlPlaneUrl: string;
  private readonly controlPlaneToken: string;
  private readonly instanceId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService,
  ) {
    this.controlPlaneUrl = this.config.get<string>("CONTROL_PLANE_URL") ?? "";
    this.controlPlaneToken = this.config.get<string>("CONTROL_PLANE_INGEST_TOKEN") ?? "";
    this.instanceId = this.config.get<string>("INSTANCE_ID") ?? "local-dev";
    this.timer = setInterval(() => {
      this.processDueDeliveries().catch(() => undefined);
    }, 2000);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private connectorSecretKey(connectorId: string) {
    return `INTEGRATION_BUILDER_CONNECTOR:${connectorId}`;
  }

  private toNullableJson(value: unknown) {
    if (value === undefined || value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  async listConnectors(companyId: string) {
    const rows = await this.prisma.integrationConnector.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const providers = rows.map((r) => r.secretProviderKey).filter((v): v is string => Boolean(v));
    const secrets = providers.length
      ? await this.prisma.secret.findMany({
          where: { companyId, provider: { in: providers } },
          select: { provider: true, verifiedAt: true, expiresAt: true, rotatedAt: true, status: true, meta: true },
        })
      : [];
    const secretMap = new Map(secrets.map((s) => [s.provider, s]));
    return rows.map((row) => ({
      ...row,
      secretStatus: row.secretProviderKey ? secretMap.get(row.secretProviderKey) ?? null : null,
    }));
  }

  async upsertConnectors(companyId: string, dto: UpsertIntegrationConnectorsDto) {
    const saved = [] as unknown[];
    for (const item of dto.items) {
      const data = {
        companyId,
        name: item.name,
        sourceEvent: item.sourceEvent,
        enabled: item.enabled ?? true,
        destinationType: (item.destinationType ?? "WEBHOOK") as IntegrationConnectorDestinationType,
        method: (item.method ?? "POST").toUpperCase(),
        destinationUrl: item.destinationUrl,
        headers: this.toNullableJson(item.headers),
        mapping: (item.mapping ?? {}) as Prisma.InputJsonValue,
        timeoutMs: item.timeoutMs ?? 10000,
        retryMaxAttempts: item.retryMaxAttempts ?? 3,
        retryBackoffBaseMs: item.retryBackoffBaseMs ?? 1000,
        authMode: (item.authMode ?? "NONE") as IntegrationConnectorAuthMode,
        authHeaderName: item.authHeaderName ?? null,
      };

      if (item.id) {
        const updated = await this.prisma.integrationConnector.update({
          where: { id: item.id },
          data,
        });
        if (!updated.secretProviderKey) {
          saved.push(
            await this.prisma.integrationConnector.update({
              where: { id: updated.id },
              data: { secretProviderKey: this.connectorSecretKey(updated.id) },
            }),
          );
        } else {
          saved.push(updated);
        }
      } else {
        const created = await this.prisma.integrationConnector.create({ data });
        saved.push(
          await this.prisma.integrationConnector.update({
            where: { id: created.id },
            data: { secretProviderKey: this.connectorSecretKey(created.id) },
          }),
        );
      }
    }
    void this.reportSummaryToControlPlane(companyId);
    return this.listConnectors(companyId);
  }

  async deleteConnector(companyId: string, id: string) {
    const row = await this.prisma.integrationConnector.updateMany({
      where: { id, companyId, deletedAt: null },
      data: { deletedAt: new Date(), enabled: false },
    });
    return { ok: row.count > 0 };
  }

  async rotateConnectorSecret(companyId: string, connectorId: string, dto: ConnectorSecretRotateDto, actorId?: string) {
    const connector = await this.prisma.integrationConnector.findFirst({
      where: { id: connectorId, companyId, deletedAt: null },
    });
    if (!connector) throw new Error("Connector not found");
    const provider = connector.secretProviderKey ?? this.connectorSecretKey(connector.id);
    if (!connector.secretProviderKey) {
      await this.prisma.integrationConnector.update({ where: { id: connector.id }, data: { secretProviderKey: provider } });
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    const secret = await this.secrets.rotateSecret({
      companyId,
      provider,
      payload: dto.payload,
      actorId,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
      verified: dto.verified,
    });
    return {
      ok: true,
      provider,
      secret: {
        status: secret.status,
        verifiedAt: secret.verifiedAt,
        expiresAt: secret.expiresAt,
        rotatedAt: secret.rotatedAt,
      },
    };
  }

  async preview(companyId: string, dto: IntegrationBuilderPreviewDto) {
    const cfg = dto.connector ?? {};
    const secretProviderKey = cfg.id ? this.connectorSecretKey(String(cfg.id)) : undefined;
    const secret = secretProviderKey ? await this.secrets.getSecret(companyId, secretProviderKey) : null;
    const payload = applyJsonMapping(cfg.mapping ?? {}, { event: dto.sampleEvent, secret });
    const headers = applyJsonMapping(cfg.headers ?? {}, { event: dto.sampleEvent, secret });
    return {
      ok: true,
      request: {
        method: String(cfg.method ?? "POST").toUpperCase(),
        url: String(cfg.destinationUrl ?? ""),
        headers,
        payload,
      },
    };
  }

  async onEventStored(event: EventEnvelope) {
    if (!event.companyId) return;
    const connectors = await this.prisma.integrationConnector.findMany({
      where: {
        companyId: event.companyId,
        deletedAt: null,
        enabled: true,
        sourceEvent: event.name,
      },
      select: { id: true, companyId: true, sourceEvent: true, retryMaxAttempts: true },
    });
    if (connectors.length === 0) return;

    for (const connector of connectors) {
      await this.prisma.integrationConnectorDelivery
        .create({
          data: {
            companyId: connector.companyId,
            connectorId: connector.id,
            eventId: event.id,
            sourceEvent: event.name,
            status: IntegrationConnectorDeliveryStatus.PENDING,
            maxAttempts: connector.retryMaxAttempts,
            eventEnvelope: event as unknown,
          },
        })
        .catch(() => undefined); // dedupe by unique(connectorId,eventId)
    }
  }

  async processDueDeliveries(limit = 25) {
    const now = new Date();
    const due = await this.prisma.integrationConnectorDelivery.findMany({
      where: {
        status: { in: [IntegrationConnectorDeliveryStatus.PENDING, IntegrationConnectorDeliveryStatus.RETRY_SCHEDULED] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      include: {
        connector: true,
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
    for (const delivery of due) {
      const claimed = await this.prisma.integrationConnectorDelivery.updateMany({
        where: {
          id: delivery.id,
          status: { in: [IntegrationConnectorDeliveryStatus.PENDING, IntegrationConnectorDeliveryStatus.RETRY_SCHEDULED] },
        },
        data: {
          status: IntegrationConnectorDeliveryStatus.PROCESSING,
          lastAttemptAt: now,
        },
      });
      if (claimed.count === 0) continue;
      await this.executeDelivery(delivery.id).catch(() => undefined);
    }
  }

  private async executeDelivery(deliveryId: string) {
    const delivery = await this.prisma.integrationConnectorDelivery.findUnique({
      where: { id: deliveryId },
      include: { connector: true },
    });
    if (!delivery) return;
    if (delivery.connector.deletedAt || !delivery.connector.enabled) {
      await this.prisma.integrationConnectorDelivery.update({
        where: { id: delivery.id },
        data: {
          status: IntegrationConnectorDeliveryStatus.FAILED,
          error: "connector_disabled_or_deleted",
          attemptCount: delivery.attemptCount + 1,
        },
      });
      return;
    }

    const event = delivery.eventEnvelope as unknown;
    const secret = delivery.connector.secretProviderKey
      ? await this.secrets.getSecret(delivery.companyId, delivery.connector.secretProviderKey)
      : null;

    const outboundPayload = applyJsonMapping(delivery.connector.mapping, { event, secret });
    const outboundHeaders = (applyJsonMapping(delivery.connector.headers ?? {}, { event, secret }) ?? {}) as Record<
      string,
      unknown
    >;

    const method = String(delivery.connector.method ?? "POST").toUpperCase();
    const authMode = delivery.connector.authMode;
    if (authMode === IntegrationConnectorAuthMode.BEARER_TOKEN && secret?.token) {
      outboundHeaders.Authorization = `Bearer ${String(secret.token)}`;
    } else if (authMode === IntegrationConnectorAuthMode.API_KEY_HEADER) {
      const headerName = delivery.connector.authHeaderName || "x-api-key";
      outboundHeaders[headerName] = String(secret?.apiKey ?? secret?.token ?? "");
    }
    if (!outboundHeaders["Content-Type"]) outboundHeaders["Content-Type"] = "application/json";

    const started = Date.now();
    const timeoutMs = Math.max(500, Math.min(delivery.connector.timeoutMs, 120000));
    try {
      const response = await this.performHttp(delivery.connector.destinationUrl, {
        method,
        headers: outboundHeaders as unknown,
        body: ["GET", "DELETE"].includes(method) ? undefined : JSON.stringify(outboundPayload),
        timeoutMs,
      });
      const durationMs = Date.now() - started;
      const success = response.status >= 200 && response.status < 300;

      if (success) {
        await this.prisma.integrationConnectorDelivery.update({
          where: { id: delivery.id },
          data: {
            status: IntegrationConnectorDeliveryStatus.SUCCESS,
            attemptCount: delivery.attemptCount + 1,
            deliveredAt: new Date(),
            durationMs,
            requestPayload: outboundPayload as unknown,
            requestHeaders: outboundHeaders as unknown,
            responseStatus: response.status,
            responseBody: response.body.slice(0, 8000),
            error: null,
            nextAttemptAt: null,
          },
        });
        await this.prisma.integrationConnector.update({
          where: { id: delivery.connectorId },
          data: {
            lastSuccessAt: new Date(),
            lastError: null,
          },
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.body.slice(0, 250)}`);
      }
    } catch (error: unknown) {
      const attempt = delivery.attemptCount + 1;
      const finalAttempt = attempt >= delivery.maxAttempts;
      const durationMs = Date.now() - started;
      const errorMessage = String(error?.message ?? error ?? "delivery_failed").slice(0, 4000);
      if (finalAttempt) {
        await this.prisma.integrationConnectorDelivery.update({
          where: { id: delivery.id },
          data: {
            status: IntegrationConnectorDeliveryStatus.DLQ,
            attemptCount: attempt,
            durationMs,
            error: errorMessage,
            nextAttemptAt: null,
            requestPayload: outboundPayload as unknown,
            requestHeaders: outboundHeaders as unknown,
          },
        });
      } else {
        const backoffMs = computeRetryBackoffMs(delivery.connector.retryBackoffBaseMs, attempt);
        await this.prisma.integrationConnectorDelivery.update({
          where: { id: delivery.id },
          data: {
            status: IntegrationConnectorDeliveryStatus.RETRY_SCHEDULED,
            attemptCount: attempt,
            durationMs,
            error: errorMessage,
            nextAttemptAt: new Date(Date.now() + backoffMs),
            requestPayload: outboundPayload as unknown,
            requestHeaders: outboundHeaders as unknown,
          },
        });
      }
      await this.prisma.integrationConnector.update({
        where: { id: delivery.connectorId },
        data: {
          lastFailureAt: new Date(),
          lastError: errorMessage,
        },
      });
    } finally {
      void this.reportSummaryToControlPlane(delivery.companyId);
    }
  }

  protected async performHttp(
    url: string,
    options: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number },
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const res = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      const text = await res.text();
      return { status: res.status, body: text };
    } finally {
      clearTimeout(timer);
    }
  }

  async listDeliveryLogs(companyId: string, connectorId: string, query: DeliveryLogsQueryDto) {
    return this.prisma.integrationConnectorDelivery.findMany({
      where: {
        companyId,
        connectorId,
        status: query.status ? (query.status as unknown) : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 50,
    });
  }

  async getConnectorMetrics(companyId: string, connectorId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deliveries = await this.prisma.integrationConnectorDelivery.findMany({
      where: { companyId, connectorId, createdAt: { gte: since } },
      select: { status: true, durationMs: true, attemptCount: true, createdAt: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    });
    const total = deliveries.length;
    const success = deliveries.filter((d) => d.status === IntegrationConnectorDeliveryStatus.SUCCESS).length;
    const dlq = deliveries.filter((d) => d.status === IntegrationConnectorDeliveryStatus.DLQ).length;
    const retryScheduled = deliveries.filter((d) => d.status === IntegrationConnectorDeliveryStatus.RETRY_SCHEDULED).length;
    const durations = deliveries.map((d) => d.durationMs ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
    const p95 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : 0;
    const avgAttempts = total
      ? Number((deliveries.reduce((sum, d) => sum + (d.attemptCount ?? 0), 0) / total).toFixed(2))
      : 0;
    return {
      connectorId,
      window: "24h",
      total,
      success,
      dlq,
      retryScheduled,
      successRate: total ? Number((success / total).toFixed(4)) : 0,
      p95DurationMs: p95 ?? 0,
      avgAttempts,
    };
  }

  async listAllConnectorMetrics(companyId: string) {
    const connectors = await this.prisma.integrationConnector.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sourceEvent: true, enabled: true },
    });
    const metrics = [];
    for (const connector of connectors) {
      metrics.push({ connector, metrics: await this.getConnectorMetrics(companyId, connector.id) });
    }
    return metrics;
  }

  async retryDlq(companyId: string, connectorId: string) {
    const rows = await this.prisma.integrationConnectorDelivery.updateMany({
      where: { companyId, connectorId, status: IntegrationConnectorDeliveryStatus.DLQ },
      data: {
        status: IntegrationConnectorDeliveryStatus.RETRY_SCHEDULED,
        nextAttemptAt: new Date(),
        error: null,
      },
    });
    return { ok: true, requeued: rows.count };
  }

  async reportSummaryToControlPlane(companyId: string) {
    if (!this.controlPlaneUrl || !this.controlPlaneToken) return;
    try {
      const connectors = await this.prisma.integrationConnector.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, enabled: true, name: true },
      });
      const connectorIds = connectors.map((c) => c.id);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deliveries = connectorIds.length
        ? await this.prisma.integrationConnectorDelivery.findMany({
            where: { companyId, connectorId: { in: connectorIds }, createdAt: { gte: since } },
            select: { connectorId: true, status: true, durationMs: true, attemptCount: true },
            take: 20000,
          })
        : [];
      const perConnector = connectors.map((c) => {
        const rows = deliveries.filter((d) => d.connectorId === c.id);
        return {
          connectorId: c.id,
          name: c.name,
          enabled: c.enabled,
          total24h: rows.length,
          success24h: rows.filter((r) => r.status === "SUCCESS").length,
          dlq24h: rows.filter((r) => r.status === "DLQ").length,
          retry24h: rows.filter((r) => r.status === "RETRY_SCHEDULED").length,
        };
      });
      const payload = {
        instanceId: this.instanceId,
        companyId,
        capturedAt: new Date().toISOString(),
        connectorsTotal: connectors.length,
        connectorsActive: connectors.filter((c) => c.enabled).length,
        deliveriesSuccess24h: deliveries.filter((d) => d.status === "SUCCESS").length,
        deliveriesFailed24h: deliveries.filter((d) => d.status === "FAILED" || d.status === "DLQ").length,
        dlqOpen: deliveries.filter((d) => d.status === "DLQ").length,
        perConnector,
      };
      await fetch(`${this.controlPlaneUrl.replace(/\/$/, "")}/api/integration-builder/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cp-ingest-token": this.controlPlaneToken,
        },
        body: JSON.stringify(payload),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown";
      this.logger.warn(`control-plane integration-builder report failed: ${message}`);
    }
  }
}
