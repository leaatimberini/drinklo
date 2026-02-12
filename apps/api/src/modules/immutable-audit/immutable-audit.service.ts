import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type RecordInput = {
  companyId: string;
  category: "configuration" | "pricing" | "stock" | "billing";
  action: string;
  method: string;
  route: string;
  statusCode: number;
  actorUserId?: string | null;
  actorRole?: string | null;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payload?: any;
};

export function stableStringify(value: any): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function computeChainHash(parts: {
  previousHash?: string | null;
  payloadHash: string;
  meta: string;
}) {
  return sha256(`${parts.previousHash ?? "GENESIS"}|${parts.payloadHash}|${parts.meta}`);
}

@Injectable()
export class ImmutableAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextAggregateVersion(companyId: string, aggregateType?: string | null, aggregateId?: string | null) {
    if (!aggregateType || !aggregateId) return null;
    const latest = await this.prisma.immutableAuditLog.findFirst({
      where: { companyId, aggregateType, aggregateId },
      orderBy: { createdAt: "desc" },
      select: { aggregateVersion: true },
    });
    return (latest?.aggregateVersion ?? 0) + 1;
  }

  async append(input: RecordInput) {
    const latest = await this.prisma.immutableAuditLog.findFirst({
      where: { companyId: input.companyId },
      orderBy: { createdAt: "desc" },
      select: { chainHash: true },
    });

    const safePayload = input.payload ? JSON.parse(stableStringify(input.payload)) : null;
    const payloadHash = sha256(stableStringify(safePayload));
    const aggregateVersion = await this.nextAggregateVersion(input.companyId, input.aggregateType, input.aggregateId);
    const meta = stableStringify({
      companyId: input.companyId,
      category: input.category,
      action: input.action,
      method: input.method,
      route: input.route,
      statusCode: input.statusCode,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      aggregateType: input.aggregateType ?? null,
      aggregateId: input.aggregateId ?? null,
      aggregateVersion,
    });

    const chainHash = computeChainHash({
      previousHash: latest?.chainHash,
      payloadHash,
      meta,
    });

    return this.prisma.immutableAuditLog.create({
      data: {
        companyId: input.companyId,
        category: input.category,
        action: input.action,
        method: input.method,
        route: input.route,
        statusCode: input.statusCode,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        aggregateType: input.aggregateType ?? null,
        aggregateId: input.aggregateId ?? null,
        aggregateVersion,
        payload: safePayload,
        payloadHash,
        previousHash: latest?.chainHash ?? null,
        chainHash,
      },
    });
  }

  async list(companyId: string, query: any) {
    return this.prisma.immutableAuditLog.findMany({
      where: {
        companyId,
        category: query.category ?? undefined,
        action: query.action ?? undefined,
        route: query.route ? { contains: query.route, mode: "insensitive" } : undefined,
        actorUserId: query.actorUserId ?? undefined,
        aggregateType: query.aggregateType ?? undefined,
        aggregateId: query.aggregateId ?? undefined,
        createdAt:
          query.from || query.to
            ? {
                gte: query.from ? new Date(query.from) : undefined,
                lte: query.to ? new Date(query.to) : undefined,
              }
            : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(500, Number(query.limit ?? 100)),
    });
  }

  verifyChain(logs: Array<any>) {
    const ordered = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let previous: string | null = null;
    for (const log of ordered) {
      if ((log.previousHash ?? null) !== previous) {
        return { ok: false, reason: "previous_hash_mismatch", logId: log.id };
      }
      const meta = stableStringify({
        companyId: log.companyId,
        category: log.category,
        action: log.action,
        method: log.method,
        route: log.route,
        statusCode: log.statusCode,
        actorUserId: log.actorUserId ?? null,
        actorRole: log.actorRole ?? null,
        aggregateType: log.aggregateType ?? null,
        aggregateId: log.aggregateId ?? null,
        aggregateVersion: log.aggregateVersion ?? null,
      });
      const recomputedPayloadHash = sha256(stableStringify(log.payload));
      if (recomputedPayloadHash !== log.payloadHash) {
        return { ok: false, reason: "payload_hash_mismatch", logId: log.id };
      }
      const recomputedChain = computeChainHash({
        previousHash: log.previousHash,
        payloadHash: log.payloadHash,
        meta,
      });
      if (recomputedChain !== log.chainHash) {
        return { ok: false, reason: "chain_hash_mismatch", logId: log.id };
      }
      previous = log.chainHash;
    }
    return { ok: true, count: ordered.length, tailHash: previous };
  }

  async verify(companyId: string, query: any) {
    const logs = await this.list(companyId, { ...query, limit: 10000 });
    return this.verifyChain(logs);
  }

  signEvidencePack(pack: any) {
    const secret = process.env.AUDIT_EVIDENCE_SECRET ?? process.env.JWT_SECRET ?? "dev-audit-secret";
    const canonical = stableStringify(pack);
    return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  }

  async exportEvidencePack(companyId: string, query: any) {
    const logs = await this.list(companyId, { ...query, limit: 10000 });
    const verification = this.verifyChain(logs);
    const pack = {
      companyId,
      exportedAt: new Date().toISOString(),
      criteria: query,
      verification,
      entries: logs,
    };
    const signature = this.signEvidencePack(pack);
    return { ...pack, signature, signatureAlgorithm: "HMAC-SHA256" };
  }

  async recordCriticalFromRequest(req: any, result: any, statusCode: number) {
    const route = req?.route?.path ? `${req.baseUrl ?? ""}${req.route.path}` : req?.url ?? "";
    const method = String(req?.method ?? "GET").toUpperCase();
    const map = this.classify(method, route);
    if (!map) return;

    const companyId = req?.user?.companyId ?? result?.companyId ?? null;
    if (!companyId) return;

    await this.append({
      companyId,
      category: map.category,
      action: map.action,
      method,
      route,
      statusCode,
      actorUserId: req?.user?.sub ?? null,
      actorRole: req?.user?.role ?? null,
      aggregateType: map.aggregateType,
      aggregateId: String(result?.id ?? result?.companyId ?? result?.invoiceId ?? result?.stockItemId ?? "") || null,
      payload: {
        params: req?.params,
        query: req?.query,
        body: req?.body,
        resultSummary: result && typeof result === "object" ? Object.keys(result).slice(0, 20) : null,
      },
    });
  }

  private classify(method: string, route: string) {
    const r = route.toLowerCase();
    if (r.startsWith("/setup") || r.startsWith("/themes") || r.startsWith("/admin/iam") || r.startsWith("/admin/secrets")) {
      return { category: "configuration" as const, action: `${method} ${route}`, aggregateType: "config" };
    }
    if (r.startsWith("/stock") || r.includes("stock")) {
      return { category: "stock" as const, action: `${method} ${route}`, aggregateType: "stock" };
    }
    if (r.startsWith("/billing") || r.includes("invoice") || r.startsWith("/admin/license")) {
      return { category: "billing" as const, action: `${method} ${route}`, aggregateType: "billing" };
    }
    if (r.includes("price") || r.startsWith("/admin/promos") || r.startsWith("/catalog")) {
      return { category: "pricing" as const, action: `${method} ${route}`, aggregateType: "pricing" };
    }
    return null;
  }
}
