import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";
import { hashApiKeySecret, maskIp, signDeveloperWebhook } from "./developer-api.crypto";
import { redactDeep } from "../data-governance/dlp-redactor";

export const DEVELOPER_API_SCOPES = [
  "read:products",
  "read:categories",
  "read:pricelists",
  "read:stock",
  "read:orders",
  "write:orders",
] as const;

export type DeveloperApiScope = (typeof DEVELOPER_API_SCOPES)[number];

function normalizeScopes(scopes: string[]) {
  const allowed = new Set<string>(DEVELOPER_API_SCOPES);
  const normalized = Array.from(new Set(scopes.map((scope) => String(scope).trim()).filter(Boolean)));
  const invalid = normalized.filter((scope) => !allowed.has(scope));
  if (invalid.length > 0) {
    throw new ForbiddenException(`Invalid scopes: ${invalid.join(", ")}`);
  }
  return normalized;
}

type ValidateKeyInput = {
  rawKey: string;
  route: string;
  method: string;
  ip?: string;
  userAgent?: string;
  requiredScopes: string[];
};

export type DeveloperRequestContext = {
  companyId: string;
  keyId: string;
  scopes: string[];
  route: string;
  method: string;
  ipMasked: string | null;
  userAgent?: string;
};

@Injectable()
export class DeveloperApiService {
  private readonly rateWindow = new Map<string, { resetAt: number; count: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ImmutableAuditService,
  ) {}

  async createKey(
    companyId: string,
    data: {
      name: string;
      scopes: string[];
      rateLimitPerMin?: number;
      createdById?: string;
      prefix: string;
      secret: string;
    },
  ) {
    const keyHash = hashApiKeySecret(data.secret);
    const created = await this.prisma.developerApiKey.create({
      data: {
        companyId,
        name: data.name,
        keyPrefix: data.prefix,
        keyHash,
        scopes: normalizeScopes(data.scopes),
        rateLimitPerMin: data.rateLimitPerMin ?? 120,
        createdById: data.createdById,
      },
    });

    await this.audit.append({
      companyId,
      category: "configuration",
      action: "DEVELOPER_API_KEY_CREATED",
      method: "POST",
      route: "/admin/developer-api/keys",
      statusCode: 201,
      actorUserId: data.createdById ?? null,
      aggregateType: "developer-api-key",
      aggregateId: created.id,
      payload: { keyId: created.id, scopes: created.scopes, name: data.name },
    });

    return created;
  }

  async listKeys(companyId: string) {
    return this.prisma.developerApiKey.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMin: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async updateKey(companyId: string, keyId: string, input: { scopes?: string[]; rateLimitPerMin?: number }, actorUserId?: string) {
    const key = await this.prisma.developerApiKey.findFirst({ where: { id: keyId, companyId } });
    if (!key) {
      throw new NotFoundException("Key not found");
    }

    const updated = await this.prisma.developerApiKey.update({
      where: { id: keyId },
      data: {
        scopes: input.scopes ? normalizeScopes(input.scopes) : undefined,
        rateLimitPerMin: input.rateLimitPerMin ?? undefined,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMin: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    await this.audit.append({
      companyId,
      category: "configuration",
      action: "DEVELOPER_API_KEY_UPDATED",
      method: "PATCH",
      route: "/admin/developer-api/keys/:id",
      statusCode: 200,
      actorUserId: actorUserId ?? null,
      aggregateType: "developer-api-key",
      aggregateId: keyId,
      payload: redactDeep(input),
    });

    return updated;
  }

  async revokeKey(companyId: string, keyId: string, actorUserId?: string) {
    const key = await this.prisma.developerApiKey.findFirst({ where: { id: keyId, companyId } });
    if (!key) {
      throw new NotFoundException("Key not found");
    }

    await this.prisma.developerApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    await this.audit.append({
      companyId,
      category: "configuration",
      action: "DEVELOPER_API_KEY_REVOKED",
      method: "POST",
      route: "/admin/developer-api/keys/:id/revoke",
      statusCode: 200,
      actorUserId: actorUserId ?? null,
      aggregateType: "developer-api-key",
      aggregateId: keyId,
      payload: { keyId },
    });

    return { ok: true };
  }

  async usage(companyId: string, from?: string, to?: string) {
    const where = {
      companyId,
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    } as const;

    const [recent, agg, rateHits] = await Promise.all([
      this.prisma.developerApiUsage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.developerApiUsage.groupBy({
        by: ["route", "method"],
        where,
        _count: { _all: true },
      }),
      this.prisma.developerApiUsage.count({ where: { ...where, rateLimited: true } }),
    ]);

    return {
      recent,
      byRoute: agg.map((row) => ({ route: row.route, method: row.method, requests: row._count._all })),
      rateLimitHits: rateHits,
    };
  }

  async validateAndConsume(input: ValidateKeyInput): Promise<DeveloperRequestContext> {
    const [prefix, secret] = String(input.rawKey ?? "").split(".");
    if (!prefix || !secret) {
      throw new UnauthorizedException("Invalid API key format");
    }

    const key = await this.prisma.developerApiKey.findFirst({ where: { keyPrefix: prefix } });
    if (!key || key.revokedAt) {
      throw new UnauthorizedException("API key revoked or not found");
    }

    const hash = hashApiKeySecret(secret);
    if (hash !== key.keyHash) {
      throw new UnauthorizedException("Invalid API key");
    }

    const missingScopes = input.requiredScopes.filter((scope) => !key.scopes.includes(scope));
    if (missingScopes.length > 0) {
      await this.logUsage({
        companyId: key.companyId,
        keyId: key.id,
        route: input.route,
        method: input.method,
        statusCode: 403,
        ipMasked: maskIp(input.ip),
        userAgent: input.userAgent,
        scopeDenied: true,
      });
      throw new ForbiddenException(`Missing scopes: ${missingScopes.join(", ")}`);
    }

    const ipBucket = `${key.id}:${input.ip ?? "unknown"}`;
    const now = Date.now();
    const bucket = this.rateWindow.get(ipBucket) ?? { resetAt: now + 60_000, count: 0 };
    if (now >= bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + 60_000;
    }
    bucket.count += 1;
    this.rateWindow.set(ipBucket, bucket);
    if (bucket.count > key.rateLimitPerMin) {
      await this.logUsage({
        companyId: key.companyId,
        keyId: key.id,
        route: input.route,
        method: input.method,
        statusCode: 429,
        ipMasked: maskIp(input.ip),
        userAgent: input.userAgent,
        rateLimited: true,
      });
      throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.developerApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      companyId: key.companyId,
      keyId: key.id,
      scopes: key.scopes,
      route: input.route,
      method: input.method,
      ipMasked: maskIp(input.ip),
      userAgent: input.userAgent,
    };
  }

  async logUsage(args: {
    companyId: string;
    keyId?: string | null;
    route: string;
    method: string;
    statusCode: number;
    ipMasked?: string | null;
    userAgent?: string;
    scopeDenied?: boolean;
    rateLimited?: boolean;
  }) {
    await this.prisma.developerApiUsage.create({
      data: {
        companyId: args.companyId,
        keyId: args.keyId ?? null,
        route: args.route,
        method: args.method,
        statusCode: args.statusCode,
        ipMasked: args.ipMasked ?? null,
        userAgent: args.userAgent,
        scopeDenied: args.scopeDenied ?? false,
        rateLimited: args.rateLimited ?? false,
      },
    });

    await this.audit.append({
      companyId: args.companyId,
      category: "configuration",
      action: `EXTERNAL_API_${args.method}_${args.route}`,
      method: args.method,
      route: args.route,
      statusCode: args.statusCode,
      aggregateType: "developer-api",
      aggregateId: args.keyId ?? null,
      payload: redactDeep({
        keyId: args.keyId ?? null,
        ipMasked: args.ipMasked ?? null,
        userAgent: args.userAgent ?? null,
        scopeDenied: args.scopeDenied ?? false,
        rateLimited: args.rateLimited ?? false,
      }),
    });
  }

  async listCategories(companyId: string) {
    return this.prisma.category.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async listProducts(companyId: string, q?: string, page = 1, pageSize = 50) {
    const where: any = { companyId, deletedAt: null };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        { variants: { some: { barcode: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { variants: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  async listPriceLists(companyId: string) {
    const lists = await this.prisma.priceList.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const rules = await this.prisma.priceRule.findMany({
      where: { companyId, deletedAt: null },
      include: { variant: { select: { id: true, sku: true } }, product: { select: { id: true, name: true } } },
      take: 2000,
    });

    return {
      lists,
      rules: rules.map((rule) => ({
        id: rule.id,
        priceListId: rule.priceListId,
        variantId: rule.variantId,
        variantSku: rule.variant?.sku ?? null,
        productId: rule.productId,
        productName: rule.product?.name ?? null,
        minQty: rule.minQty,
        price: Number(rule.price),
      })),
    };
  }

  async listStockAvailability(companyId: string) {
    const rows = await this.prisma.stockItem.findMany({
      where: { companyId, deletedAt: null },
      include: {
        variant: { select: { id: true, sku: true, barcode: true, productId: true } },
        location: { select: { id: true, name: true } },
      },
      take: 5000,
    });

    return rows.map((row) => ({
      stockItemId: row.id,
      variantId: row.variantId,
      productId: row.variant.productId,
      sku: row.variant.sku,
      barcode: row.variant.barcode,
      locationId: row.locationId,
      locationName: row.location.name,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity,
      available: row.quantity - row.reservedQuantity,
      updatedAt: row.updatedAt,
    }));
  }

  async createWebhook(companyId: string, input: { name: string; url: string; events: string[]; secret: string }) {
    return this.prisma.developerWebhookEndpoint.create({
      data: {
        companyId,
        name: input.name,
        url: input.url,
        events: Array.from(new Set(input.events.map((event) => String(event).trim()).filter(Boolean))),
        secret: input.secret,
      },
    });
  }

  async revokeWebhook(companyId: string, webhookId: string) {
    const endpoint = await this.prisma.developerWebhookEndpoint.findFirst({ where: { id: webhookId, companyId } });
    if (!endpoint) {
      throw new NotFoundException("Webhook not found");
    }
    await this.prisma.developerWebhookEndpoint.update({
      where: { id: webhookId },
      data: { active: false, deletedAt: new Date() },
    });
    return { ok: true };
  }

  async listWebhooks(companyId: string) {
    return this.prisma.developerWebhookEndpoint.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
  }

  async dispatchWebhookEvent(companyId: string, eventType: "OrderCreated" | "PaymentApproved" | "StockLow", payload: any) {
    const endpoints = await this.prisma.developerWebhookEndpoint.findMany({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        events: { has: eventType },
      },
    });

    const occurredAt = new Date();
    for (const endpoint of endpoints) {
      const envelope = {
        id: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        event: eventType,
        occurredAt: occurredAt.toISOString(),
        payload,
      };
      const body = JSON.stringify(envelope);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = signDeveloperWebhook(endpoint.secret, body, timestamp);

      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-devwebhook-id": envelope.id,
            "x-devwebhook-event": eventType,
            "x-devwebhook-signature": signature,
            "x-devwebhook-timestamp": timestamp,
          },
          body,
        });

        await this.prisma.developerWebhookDelivery.create({
          data: {
            companyId,
            endpointId: endpoint.id,
            eventType,
            payload: redactDeep(payload),
            statusCode: response.status,
            deliveredAt: new Date(),
          },
        });
      } catch (error: any) {
        await this.prisma.developerWebhookDelivery.create({
          data: {
            companyId,
            endpointId: endpoint.id,
            eventType,
            payload: redactDeep(payload),
            error: String(error?.message ?? "webhook_error"),
          },
        });
      }
    }
  }
}
