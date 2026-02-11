import { Injectable } from "@nestjs/common";
import client from "prom-client";
import { PrismaService } from "../prisma/prisma.service";

const register = new client.Registry();

client.collectDefaultMetrics({ register });

@Injectable()
export class MetricsService {
  private requestSummary = new client.Summary({
    name: "http_request_duration_ms",
    help: "HTTP request duration in ms",
    percentiles: [0.5, 0.9, 0.95, 0.99],
    registers: [register],
  });

  private requestCounter = new client.Counter({
    name: "http_requests_total",
    help: "HTTP requests total",
    labelNames: ["method", "route", "status"],
    registers: [register],
  });

  private webhookCounter = new client.Counter({
    name: "webhooks_total",
    help: "Webhooks received",
    labelNames: ["provider", "status"],
    registers: [register],
  });

  private webhookRetries = new client.Counter({
    name: "webhook_retries_total",
    help: "Webhook retries detected",
    labelNames: ["provider"],
    registers: [register],
  });

  private jobFailuresTotal = new client.Counter({
    name: "jobs_failed_total",
    help: "Job failures total",
    registers: [register],
  });

  private jobFailuresCurrent = new client.Gauge({
    name: "jobs_failed_current",
    help: "Current job failures in memory",
    registers: [register],
  });

  private appErrorsTotal = new client.Counter({
    name: "app_errors_total",
    help: "Application errors captured",
    registers: [register],
  });

  private dbPoolActive = new client.Gauge({
    name: "db_pool_active",
    help: "Database pool active connections",
    registers: [register],
  });

  private dbPoolIdle = new client.Gauge({
    name: "db_pool_idle",
    help: "Database pool idle connections",
    registers: [register],
  });

  private dbPoolTotal = new client.Gauge({
    name: "db_pool_total",
    help: "Database pool total connections",
    registers: [register],
  });

  constructor(private readonly prisma: PrismaService) {
    setInterval(() => {
      this.updateDbPoolMetrics().catch(() => undefined);
    }, 15000).unref();
  }

  recordHttpRequest(method: string, route: string, status: number, durationMs: number) {
    this.requestSummary.observe(durationMs);
    this.requestCounter.inc({
      method,
      route,
      status: String(status),
    });
  }

  recordWebhook(provider: string, status: string) {
    this.webhookCounter.inc({ provider, status });
  }

  recordWebhookRetry(provider: string) {
    this.webhookRetries.inc({ provider });
  }

  recordJobFailure() {
    this.jobFailuresTotal.inc();
  }

  setJobFailuresCurrent(count: number) {
    this.jobFailuresCurrent.set(count);
  }

  recordAppError() {
    this.appErrorsTotal.inc();
  }

  getMetrics() {
    return register.metrics();
  }

  getContentType() {
    return register.contentType;
  }

  private async updateDbPoolMetrics() {
    const prismaAny = this.prisma as any;
    if (!prismaAny?.$metrics?.json) {
      return;
    }
    const metrics = await prismaAny.$metrics.json();
    const gauges = metrics?.gauges ?? [];
    const map = new Map<string, number>();
    for (const gauge of gauges) {
      if (typeof gauge.key === "string" && typeof gauge.value === "number") {
        map.set(gauge.key, gauge.value);
      }
    }
    const active = map.get("pool_active_connections");
    const idle = map.get("pool_idle_connections");
    const total = map.get("pool_total_connections");
    if (typeof active === "number") this.dbPoolActive.set(active);
    if (typeof idle === "number") this.dbPoolIdle.set(idle);
    if (typeof total === "number") this.dbPoolTotal.set(total);
  }
}

export { register };
