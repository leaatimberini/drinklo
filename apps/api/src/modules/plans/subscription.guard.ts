import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";
import { buildRestrictedCapabilities, normalizeRestrictedModeVariant } from "./subscription-lifecycle.policy";

type ResolvedContext = {
  companyId: string;
  subscriptionStatus: string;
  restrictedVariant: "CATALOG_ONLY" | "ALLOW_BASIC_SALES";
  user?: { sub?: string; role?: string } | null;
  source: "jwt" | "developer-api-key" | "public-single-company";
};

type RoutePolicy = {
  scope:
    | "SYSTEM"
    | "ADMIN"
    | "STOREFRONT_CHECKOUT"
    | "STOREFRONT_READ"
    | "DEVELOPER_API"
    | "BOT"
    | "MARKETING_AUTOMATION"
    | "INTEGRATIONS"
    | "PUBLIC_MISC";
  mutation: boolean;
  exportOrReadSafe?: boolean;
  allowInRestricted?: boolean;
  basicSalesWrite?: boolean;
  reason?: string;
};

function parseJwtPayloadUnsafe(authHeader?: string | null): unknown | null {
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRoutePath(req: unknown) {
  const base = String(req?.baseUrl ?? "");
  const route = String(req?.route?.path ?? req?.path ?? req?.url ?? "");
  return `${base}${route}`.replace(/\/+/g, "/");
}

function isReadMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function classifyRoute(path: string, method: string): RoutePolicy {
  const m = method.toUpperCase();
  const read = isReadMethod(m);
  const p = path.toLowerCase();

  if (
    p.startsWith("/health") ||
    p.startsWith("/version") ||
    p.startsWith("/auth/") ||
    p.startsWith("/setup/") ||
    p.startsWith("/instance/") ||
    p.startsWith("/installer/") ||
    p.startsWith("/swagger") ||
    p.startsWith("/docs") ||
    p.startsWith("/payments/webhooks/") ||
    p.startsWith("/webhooks/") ||
    p.startsWith("/metrics") ||
    p.startsWith("/admin/plans/lifecycle/run")
  ) {
    return { scope: "SYSTEM", mutation: !read, allowInRestricted: true, exportOrReadSafe: read };
  }

  if (p.startsWith("/catalog/") || p === "/catalog") {
    return { scope: "STOREFRONT_READ", mutation: !read, allowInRestricted: true, exportOrReadSafe: read };
  }
  if (p.startsWith("/themes/public")) {
    return { scope: "PUBLIC_MISC", mutation: false, allowInRestricted: true, exportOrReadSafe: true };
  }
  if (p.startsWith("/checkout/")) {
    const basicSalesWrite =
      p === "/checkout/orders" ||
      p.startsWith("/checkout/orders/") ||
      p === "/checkout/quote" ||
      p.includes("/status");
    return { scope: "STOREFRONT_CHECKOUT", mutation: !read, basicSalesWrite };
  }

  if (p.startsWith("/payments/mercadopago/preference")) {
    return { scope: "STOREFRONT_CHECKOUT", mutation: true, basicSalesWrite: true };
  }

  if (p.startsWith("/developer/")) {
    return { scope: "DEVELOPER_API", mutation: !read, exportOrReadSafe: read };
  }

  if (p.startsWith("/automation") || p.startsWith("/admin/automation")) {
    return { scope: "MARKETING_AUTOMATION", mutation: !read, exportOrReadSafe: read };
  }

  if (
    p.startsWith("/admin/integrations") ||
    p.startsWith("/integration-builder") ||
    p.startsWith("/admin/integration-builder") ||
    p.startsWith("/plugins") ||
    p.startsWith("/plugin-marketplace")
  ) {
    return { scope: "INTEGRATIONS", mutation: !read, exportOrReadSafe: read };
  }

  const allowAdminMutation =
    p.startsWith("/billing/") ||
    p.startsWith("/admin/plans/") ||
    p.startsWith("/admin/licensing") ||
    p.startsWith("/payments/mercadopago/subscriptions/");

  return {
    scope: "ADMIN",
    mutation: !read,
    exportOrReadSafe: read || p.includes("/export") || p.endsWith("/pdf"),
    allowInRestricted: allowAdminMutation,
  };
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);
  private readonly cache = new Map<string, { expiresAt: number; value: ResolvedContext }>();
  private readonly developerApiBuckets = new Map<string, { resetAt: number; count: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ImmutableAuditService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req) return true;
    const method = String(req.method ?? "GET").toUpperCase();
    const path = getRoutePath(req);
    const routePolicy = classifyRoute(path, method);

    if (routePolicy.allowInRestricted) {
      return true;
    }

    const resolved = await this.resolveRequestContext(req, path);
    if (!resolved) {
      return true;
    }

    if (resolved.subscriptionStatus !== "RESTRICTED") {
      return true;
    }

    const restricted = buildRestrictedCapabilities(resolved.restrictedVariant);
    const block = this.evaluateRestrictedBlock({
      routePolicy,
      method,
      restrictedVariant: resolved.restrictedVariant,
      path,
    });

    if (!block) {
      if (routePolicy.scope === "DEVELOPER_API") {
        const limitVerdict = this.enforceDeveloperApiHardRateLimit(
          resolved.companyId,
          req.ip,
          restricted.developerApiRestrictedRateLimitPerMin,
        );
        if (!limitVerdict.ok) {
          await this.recordBlock({
            companyId: resolved.companyId,
            userId: resolved.user?.sub ?? null,
            role: resolved.user?.role ?? null,
            method,
            path,
            scope: routePolicy.scope,
            source: resolved.source,
            reason: "developer_api_restricted_rate_limit",
            variant: resolved.restrictedVariant,
          });
          throw new HttpException(
            {
              error: "rate_limited",
              code: "SUBSCRIPTION_RESTRICTED_API_RATE_LIMIT",
              message: "API publica con limite reforzado en modo restringido.",
              retryAfterSeconds: limitVerdict.retryAfterSeconds,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      return true;
    }

    await this.recordBlock({
      companyId: resolved.companyId,
      userId: resolved.user?.sub ?? null,
      role: resolved.user?.role ?? null,
      method,
      path,
      scope: routePolicy.scope,
      source: resolved.source,
      reason: block.reason,
      variant: resolved.restrictedVariant,
    });

    throw new HttpException(
      {
        error: "subscription_restricted",
        code: "SUBSCRIPTION_RESTRICTED",
        message: block.message,
        restrictedMode: {
          variant: resolved.restrictedVariant,
          scope: routePolicy.scope,
          action: method,
        },
        cta: {
          type: "UPGRADE_PLAN",
          label: "Actualizar plan",
          path: "/admin/plan-billing",
        },
      },
      block.statusCode ?? HttpStatus.PAYMENT_REQUIRED,
    );
  }

  private evaluateRestrictedBlock(input: {
    routePolicy: RoutePolicy;
    method: string;
    restrictedVariant: "CATALOG_ONLY" | "ALLOW_BASIC_SALES";
    path: string;
  }) {
    const { routePolicy, restrictedVariant, path } = input;
    if (!routePolicy.mutation) {
      return null;
    }

    if (routePolicy.scope === "STOREFRONT_CHECKOUT") {
      if (restrictedVariant === "ALLOW_BASIC_SALES" && routePolicy.basicSalesWrite) {
        return null;
      }
      return {
        reason: "checkout_blocked_catalog_only",
        message:
          "La suscripcion esta en modo restringido (catalogo). El checkout esta deshabilitado hasta actualizar el plan.",
        statusCode: HttpStatus.PAYMENT_REQUIRED,
      };
    }

    if (routePolicy.scope === "DEVELOPER_API") {
      return {
        reason: "developer_api_write_blocked",
        message: "La API publica en modo restringido permite solo lectura.",
        statusCode: HttpStatus.FORBIDDEN,
      };
    }

    if (routePolicy.scope === "MARKETING_AUTOMATION") {
      return {
        reason: "marketing_automation_paused",
        message: "Automatizaciones de marketing pausadas en modo restringido.",
      };
    }

    if (routePolicy.scope === "INTEGRATIONS") {
      return {
        reason: "integrations_sync_paused",
        message: "Sincronizaciones e integraciones de escritura estan pausadas en modo restringido.",
      };
    }

    if (routePolicy.scope === "BOT") {
      return {
        reason: "bot_mutation_blocked",
        message: "El bot solo permite consultas en modo restringido.",
        statusCode: HttpStatus.FORBIDDEN,
      };
    }

    if (routePolicy.scope === "ADMIN") {
      if (path.toLowerCase().includes("/export") || path.toLowerCase().endsWith("/pdf")) {
        return null;
      }
      return {
        reason: "admin_write_limited",
        message:
          "El plan esta en modo restringido. Ediciones no esenciales estan bloqueadas; lectura y exportacion siguen habilitadas.",
      };
    }

    return null;
  }

  private async resolveRequestContext(req: unknown, path: string): Promise<ResolvedContext | null> {
    const requestUser = req.user as { companyId?: string; sub?: string; role?: string } | undefined;
    const jwtPayload = requestUser?.companyId
      ? requestUser
      : parseJwtPayloadUnsafe(req.headers?.authorization ?? req.headers?.Authorization ?? null);
    if (jwtPayload?.companyId) {
      const value = await this.getCompanyRestriction(jwtPayload.companyId);
      if (!value) return null;
      return { ...value, user: { sub: jwtPayload.sub, role: jwtPayload.role }, source: "jwt" };
    }

    if (path.toLowerCase().startsWith("/developer/")) {
      const raw = String(req.headers?.["x-api-key"] ?? req.headers?.["X-API-Key"] ?? "");
      const prefix = raw.includes(".") ? raw.split(".")[0] : "";
      if (prefix) {
        const key = await this.prisma.developerApiKey.findFirst({
          where: { keyPrefix: prefix },
          select: { companyId: true },
        });
        if (key?.companyId) {
          const value = await this.getCompanyRestriction(key.companyId);
          if (!value) return null;
          return { ...value, user: null, source: "developer-api-key" };
        }
      }
    }

    if (
      path.toLowerCase().startsWith("/checkout/") ||
      path.toLowerCase().startsWith("/catalog/") ||
      path.toLowerCase().startsWith("/themes/public") ||
      path.toLowerCase().startsWith("/payments/mercadopago/preference")
    ) {
      const company = await this.prisma.company.findFirst({ select: { id: true } });
      if (!company) return null;
      const value = await this.getCompanyRestriction(company.id);
      if (!value) return null;
      return { ...value, user: null, source: "public-single-company" };
    }

    return null;
  }

  private async getCompanyRestriction(companyId: string) {
    const now = Date.now();
    const cached = this.cache.get(companyId);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const [subscription, settings] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { companyId },
        select: { status: true },
      }),
      this.prisma.companySettings.findUnique({
        where: { companyId },
        select: { restrictedModeVariant: true },
      }),
    ]);
    if (!subscription) return null;
    const value: ResolvedContext = {
      companyId,
      subscriptionStatus: subscription.status,
      restrictedVariant: normalizeRestrictedModeVariant(settings?.restrictedModeVariant),
      source: "jwt",
      user: null,
    };
    this.cache.set(companyId, { expiresAt: now + 15_000, value });
    return value;
  }

  private enforceDeveloperApiHardRateLimit(companyId: string, ip: string | undefined, limitPerMin: number) {
    const key = `${companyId}:${ip ?? "unknown"}`;
    const now = Date.now();
    const bucket = this.developerApiBuckets.get(key) ?? { resetAt: now + 60_000, count: 0 };
    if (now >= bucket.resetAt) {
      bucket.resetAt = now + 60_000;
      bucket.count = 0;
    }
    bucket.count += 1;
    this.developerApiBuckets.set(key, bucket);
    if (bucket.count > limitPerMin) {
      return { ok: false as const, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    return { ok: true as const };
  }

  private async recordBlock(input: {
    companyId: string;
    userId: string | null;
    role: string | null;
    method: string;
    path: string;
    scope: string;
    source: string;
    reason: string;
    variant: string;
  }) {
    const logPayload = {
      type: "subscription_restricted_block",
      companyId: input.companyId,
      userId: input.userId ?? undefined,
      role: input.role ?? undefined,
      method: input.method,
      route: input.path,
      scope: input.scope,
      reason: input.reason,
      variant: input.variant,
      source: input.source,
    };
    this.logger.warn(JSON.stringify(logPayload));
    try {
      await this.audit.append({
        companyId: input.companyId,
        category: "billing",
        action: "subscription.restricted.block",
        method: input.method,
        route: input.path,
        statusCode: 402,
        actorUserId: input.userId,
        actorRole: input.role,
        aggregateType: "subscription",
        aggregateId: input.companyId,
        payload: {
          scope: input.scope,
          reason: input.reason,
          variant: input.variant,
          source: input.source,
        },
      });
    } catch {
      // best-effort audit path
    }
  }
}

export const __subscriptionGuardTest = {
  classifyRoute,
  parseJwtPayloadUnsafe,
};
