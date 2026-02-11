import { Injectable } from "@nestjs/common";
import { OpsService } from "../ops/ops.service";

export type ServiceCheck = {
  name: string;
  url: string;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  checkedAt: string;
};

type HistoryEntry = { ok: boolean };

@Injectable()
export class SupportService {
  private history: Record<string, HistoryEntry[]> = {};

  constructor(private readonly ops: OpsService) {}

  private serviceUrls() {
    return [
      { name: "api", url: process.env.SUPPORT_API_URL ?? "http://localhost:3001/health" },
      { name: "admin", url: process.env.SUPPORT_ADMIN_URL ?? "http://localhost:3002" },
      { name: "storefront", url: process.env.SUPPORT_STOREFRONT_URL ?? "http://localhost:3003" },
      { name: "bot", url: process.env.SUPPORT_BOT_URL ?? "http://localhost:3004" },
    ];
  }

  private record(name: string, ok: boolean) {
    const arr = this.history[name] ?? [];
    arr.unshift({ ok });
    if (arr.length > 50) arr.length = 50;
    this.history[name] = arr;
  }

  private uptime(name: string) {
    const arr = this.history[name] ?? [];
    if (arr.length === 0) return 0;
    const okCount = arr.filter((e) => e.ok).length;
    return Math.round((okCount / arr.length) * 100);
  }

  async checkServices() {
    const results: ServiceCheck[] = [];
    for (const svc of this.serviceUrls()) {
      const started = Date.now();
      try {
        const res = await fetch(svc.url, { method: "GET" });
        const latency = Date.now() - started;
        const ok = res.ok;
        this.record(svc.name, ok);
        results.push({
          name: svc.name,
          url: svc.url,
          ok,
          status: res.status,
          latencyMs: latency,
          checkedAt: new Date().toISOString(),
        });
      } catch {
        const latency = Date.now() - started;
        this.record(svc.name, false);
        results.push({
          name: svc.name,
          url: svc.url,
          ok: false,
          status: undefined,
          latencyMs: latency,
          checkedAt: new Date().toISOString(),
        });
      }
    }
    return results;
  }

  async summary() {
    const services = await this.checkServices();
    const uptime = services.map((svc) => ({
      name: svc.name,
      uptimePct: this.uptime(svc.name),
    }));

    return {
      services,
      uptime,
      ops: this.ops.getSnapshot(),
      version: {
        commit: process.env.GIT_COMMIT ?? "dev",
        buildDate: process.env.BUILD_DATE ?? new Date().toISOString(),
      },
    };
  }
}
