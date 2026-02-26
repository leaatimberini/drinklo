import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ImmutableAuditService, sha256, stableStringify } from "../immutable-audit/immutable-audit.service";
import type { EdiscoveryEntity, EdiscoveryExportDto } from "./dto/ediscovery.dto";

const DEFAULT_ENTITIES: EdiscoveryEntity[] = [
  "orders",
  "invoices",
  "audit",
  "events",
  "config_changes",
  "accesses",
  "legal_holds",
];

type ExportSection = {
  name: EdiscoveryEntity;
  count: number;
  hash: string;
};

type EdiscoveryPack = {
  version: "edisco-v1";
  companyId: string;
  generatedAt: string;
  criteria: Record<string, unknown>;
  manifest: {
    sections: ExportSection[];
    payloadHash: string;
  };
  data: Record<string, unknown>;
  signatureAlgorithm: "HMAC-SHA256";
  signature: string;
};

@Injectable()
export class EdiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ImmutableAuditService,
  ) {}

  private parseDate(value?: string) {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private buildRangeWhere(field: string, from?: Date, to?: Date) {
    if (!from && !to) return {};
    return {
      [field]: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
  }

  private signable(pack: Omit<EdiscoveryPack, "signature" | "signatureAlgorithm">) {
    return {
      version: pack.version,
      companyId: pack.companyId,
      generatedAt: pack.generatedAt,
      criteria: pack.criteria,
      manifest: pack.manifest,
      data: pack.data,
    };
  }

  private buildManifest(data: Record<string, unknown>) {
    const sections: ExportSection[] = Object.entries(data).map(([name, payload]) => {
      const count = Array.isArray(payload)
        ? payload.length
        : payload && typeof payload === "object" && Array.isArray((payload as unknown).items)
          ? (payload as unknown).items.length
          : 1;
      return {
        name: name as EdiscoveryEntity,
        count,
        hash: sha256(stableStringify(payload)),
      };
    });
    sections.sort((a, b) => a.name.localeCompare(b.name));
    const payloadHash = sha256(
      stableStringify(
        sections.map((s) => ({ name: s.name, count: s.count, hash: s.hash })),
      ),
    );
    return { sections, payloadHash };
  }

  async exportForensicPack(companyId: string, dto: EdiscoveryExportDto): Promise<EdiscoveryPack> {
    const from = this.parseDate(dto.from);
    const to = this.parseDate(dto.to);
    const entities = Array.from(new Set(dto.entities?.length ? dto.entities : DEFAULT_ENTITIES));

    const data: Record<string, unknown> = {};
    for (const entity of entities) {
      data[entity] = await this.collectEntity(companyId, entity, from, to);
    }

    const base = {
      version: "edisco-v1" as const,
      companyId,
      generatedAt: new Date().toISOString(),
      criteria: {
        entities,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      manifest: this.buildManifest(data),
      data,
    };
    const signature = this.audit.signEvidencePack(this.signable(base));
    return {
      ...base,
      signatureAlgorithm: "HMAC-SHA256",
      signature,
    };
  }

  verifyForensicPack(pack: unknown) {
    if (!pack || typeof pack !== "object") {
      return { ok: false, reason: "invalid_pack" };
    }
    if (pack.version !== "edisco-v1") {
      return { ok: false, reason: "unsupported_version" };
    }
    if (!pack.data || typeof pack.data !== "object") {
      return { ok: false, reason: "missing_data" };
    }
    const recomputedManifest = this.buildManifest(pack.data);
    const manifestMatches = stableStringify(recomputedManifest) === stableStringify(pack.manifest);
    if (!manifestMatches) {
      return {
        ok: false,
        reason: "manifest_hash_mismatch",
        expected: recomputedManifest,
        actual: pack.manifest ?? null,
      };
    }
    const signatureExpected = this.audit.signEvidencePack(
      this.signable({
        version: pack.version,
        companyId: pack.companyId,
        generatedAt: pack.generatedAt,
        criteria: pack.criteria ?? {},
        manifest: pack.manifest,
        data: pack.data,
      }),
    );
    if (String(pack.signature ?? "") !== signatureExpected) {
      return { ok: false, reason: "signature_mismatch", expectedSignature: signatureExpected };
    }
    return {
      ok: true,
      manifest: pack.manifest,
      verifiedAt: new Date().toISOString(),
      signatureAlgorithm: pack.signatureAlgorithm ?? "HMAC-SHA256",
    };
  }

  private async collectEntity(companyId: string, entity: EdiscoveryEntity, from?: Date, to?: Date) {
    switch (entity) {
      case "orders": {
        const items = await this.prisma.order.findMany({
          where: {
            companyId,
            ...this.buildRangeWhere("createdAt", from, to),
          } as unknown,
          include: {
            items: true,
            payments: true,
            statusEvents: true,
            taxBreakdown: true,
          },
          orderBy: { createdAt: "asc" },
          take: 5000,
        });
        return { items, truncated: items.length >= 5000 };
      }
      case "invoices": {
        const [invoices, afipLogs] = await Promise.all([
          this.prisma.invoice.findMany({
            where: {
              companyId,
              ...this.buildRangeWhere("createdAt", from, to),
            } as unknown,
            orderBy: { createdAt: "asc" },
            take: 5000,
          }),
          this.prisma.afipLog.findMany({
            where: {
              companyId,
              ...this.buildRangeWhere("createdAt", from, to),
            } as unknown,
            orderBy: { createdAt: "asc" },
            take: 5000,
          }),
        ]);
        return { invoices, afipLogs, truncated: invoices.length >= 5000 || afipLogs.length >= 5000 };
      }
      case "audit": {
        const logs = await this.prisma.immutableAuditLog.findMany({
          where: {
            companyId,
            ...this.buildRangeWhere("createdAt", from, to),
          } as unknown,
          orderBy: { createdAt: "asc" },
          take: 10000,
        });
        return {
          items: logs,
          chainVerification: this.audit.verifyChain(logs as unknown),
          truncated: logs.length >= 10000,
        };
      }
      case "events": {
        const items = await this.prisma.eventLog.findMany({
          where: {
            companyId,
            ...this.buildRangeWhere("receivedAt", from, to),
          } as unknown,
          orderBy: { receivedAt: "asc" },
          take: 10000,
        });
        return { items, truncated: items.length >= 10000 };
      }
      case "config_changes": {
        const [configAudit, settings, retention, sodPolicies, secretsAudit] = await Promise.all([
          this.prisma.immutableAuditLog.findMany({
            where: {
              companyId,
              category: "configuration",
              ...this.buildRangeWhere("createdAt", from, to),
            } as unknown,
            orderBy: { createdAt: "asc" },
            take: 5000,
          }),
          this.prisma.companySettings.findUnique({ where: { companyId } }),
          this.prisma.dataRetentionPolicy.findMany({ where: { companyId }, orderBy: [{ plan: "asc" }, { entity: "asc" }] }),
          this.prisma.sodPolicy.findMany({ where: { companyId }, orderBy: { code: "asc" } }),
          this.prisma.secretAudit.findMany({
            where: {
              companyId,
              ...this.buildRangeWhere("createdAt", from, to),
            } as unknown,
            orderBy: { createdAt: "asc" },
            take: 2000,
          }),
        ]);
        return {
          immutableConfigAudit: configAudit,
          snapshots: { companySettings: settings, retentionPolicies: retention, sodPolicies },
          secretAudits: secretsAudit,
        };
      }
      case "accesses": {
        const [users, roles, permissions, rolePermissions, userBranches, accessReviews] = await Promise.all([
          this.prisma.user.findMany({
            where: { companyId },
            select: {
              id: true,
              roleId: true,
              email: true,
              name: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
            },
            orderBy: { email: "asc" },
          }),
          this.prisma.role.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
          this.prisma.permission.findMany({ where: { companyId }, orderBy: { code: "asc" } }),
          this.prisma.rolePermission.findMany({ where: { companyId }, orderBy: [{ roleId: "asc" }, { permissionId: "asc" }] }),
          this.prisma.userBranch.findMany({ where: { companyId }, orderBy: [{ userId: "asc" }, { branchId: "asc" }] }),
          this.prisma.accessReviewCampaign.findMany({
            where: {
              companyId,
              ...this.buildRangeWhere("createdAt", from, to),
            } as unknown,
            include: {
              items: true,
            },
            orderBy: { createdAt: "asc" },
            take: 1000,
          }),
        ]);
        return { users, roles, permissions, rolePermissions, userBranches, accessReviews };
      }
      case "legal_holds": {
        const items = await this.prisma.legalHold.findMany({
          where: {
            companyId,
            ...this.buildRangeWhere("createdAt", from, to),
          } as unknown,
          include: {
            customer: { select: { id: true, name: true, email: true } },
            user: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            releasedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 5000,
        });
        return {
          items,
          evidenceManifest: items.map((h) => ({
            id: h.id,
            evidenceHash: h.evidenceHash ?? null,
            status: h.status,
            entityScopes: h.entityScopes,
            subject: {
              customerId: h.customerId ?? null,
              userId: h.userId ?? null,
            },
          })),
        };
      }
      default:
        return { items: [] };
    }
  }
}

