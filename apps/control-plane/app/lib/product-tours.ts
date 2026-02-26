import type { PrismaClient, ProductTourSurface, ProductTourTriggerType } from "./generated/prisma";
import { hashEvidencePayload } from "./compliance-evidence";
import { loadActivationScoresDashboard } from "./activation-score";

type AnyPrisma = PrismaClient | any;

type TourCondition = {
  rolesIn?: string[];
  icpIn?: string[];
  localesIn?: string[];
  pathPrefixes?: string[];
};

type TourTriggerConfig = {
  featureKey?: string;
  minCount?: number;
  daysRemainingLte?: number;
};

type PublicTourContext = {
  surface: "ADMIN" | "STOREFRONT";
  locale?: string | null;
  role?: string | null;
  icp?: string | null;
  path?: string | null;
  trialDaysRemaining?: number | null;
  featureUsage?: Record<string, number>;
  seenTourKeys?: string[];
  completedTourKeys?: string[];
};

function normalizeLocale(input: string | null | undefined) {
  const v = String(input ?? "es").toLowerCase();
  return v.startsWith("en") ? "en" : "es";
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((v) => String(v).trim()).filter(Boolean)));
}

function parseJsonObject<T extends Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as T;
}

function evaluateCondition(condition: TourCondition | null | undefined, ctx: PublicTourContext) {
  if (!condition) return true;
  const role = String(ctx.role ?? "").toLowerCase();
  const icp = String(ctx.icp ?? "").toLowerCase();
  const locale = normalizeLocale(ctx.locale);
  const path = String(ctx.path ?? "");

  const rolesIn = normalizeArray(condition.rolesIn).map((v) => v.toLowerCase());
  if (rolesIn.length && !rolesIn.includes(role)) return false;
  const icpIn = normalizeArray(condition.icpIn).map((v) => v.toLowerCase());
  if (icpIn.length && !icpIn.includes(icp)) return false;
  const localesIn = normalizeArray(condition.localesIn).map((v) => normalizeLocale(v));
  if (localesIn.length && !localesIn.includes(locale)) return false;
  const pathPrefixes = normalizeArray(condition.pathPrefixes);
  if (pathPrefixes.length && !pathPrefixes.some((prefix) => path.startsWith(prefix))) return false;
  return true;
}

function evaluateTrigger(
  triggerType: ProductTourTriggerType,
  triggerConfig: TourTriggerConfig | null | undefined,
  ctx: PublicTourContext,
  tourKey: string,
) {
  if (triggerType === "ALWAYS") return true;
  if (triggerType === "FIRST_TIME") {
    const seen = new Set((ctx.seenTourKeys ?? []).map((v) => String(v)));
    const completed = new Set((ctx.completedTourKeys ?? []).map((v) => String(v)));
    return !seen.has(tourKey) && !completed.has(tourKey);
  }
  if (triggerType === "FEATURE_UNUSED") {
    const featureKey = String(triggerConfig?.featureKey ?? "").trim();
    if (!featureKey) return false;
    const minCount = Math.max(0, Number(triggerConfig?.minCount ?? 1));
    const count = Number(ctx.featureUsage?.[featureKey] ?? 0);
    return count < minCount;
  }
  if (triggerType === "TRIAL_NEARING_END") {
    if (ctx.trialDaysRemaining == null) return false;
    const limit = Number(triggerConfig?.daysRemainingLte ?? 3);
    return Number(ctx.trialDaysRemaining) <= limit;
  }
  return false;
}

export function normalizeProductTourInput(input: {
  key: string;
  name: string;
  surface: "ADMIN" | "STOREFRONT";
  status?: string;
  locale?: string;
  title?: string | null;
  description?: string | null;
  condition?: unknown;
  triggerType?: string;
  triggerConfig?: unknown;
  installationId?: string | null;
  steps?: Array<{
    id?: string;
    order?: number;
    locale?: string | null;
    title: string;
    body: string;
    targetSelector: string;
    placement?: string | null;
    condition?: unknown;
  }>;
}) {
  const key = String(input.key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) throw new Error("tour_key_required");
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("tour_name_required");
  const surface = String(input.surface ?? "").toUpperCase();
  if (surface !== "ADMIN" && surface !== "STOREFRONT") throw new Error("invalid_surface");
  const status = ["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(input.status ?? "DRAFT").toUpperCase())
    ? String(input.status ?? "DRAFT").toUpperCase()
    : "DRAFT";
  const locale = normalizeLocale(input.locale);
  const triggerType = ["ALWAYS", "FIRST_TIME", "FEATURE_UNUSED", "TRIAL_NEARING_END"].includes(
    String(input.triggerType ?? "ALWAYS").toUpperCase(),
  )
    ? String(input.triggerType ?? "ALWAYS").toUpperCase()
    : "ALWAYS";
  const condition = parseJsonObject(input.condition);
  const triggerConfig = parseJsonObject(input.triggerConfig);
  const steps = (input.steps ?? [])
    .map((step, idx) => ({
      id: step.id ? String(step.id) : undefined,
      order: Number.isFinite(Number(step.order)) ? Number(step.order) : idx + 1,
      locale: step.locale ? normalizeLocale(step.locale) : null,
      title: String(step.title ?? "").trim(),
      body: String(step.body ?? "").trim(),
      targetSelector: String(step.targetSelector ?? "").trim(),
      placement: step.placement ? String(step.placement).trim() : null,
      condition: parseJsonObject(step.condition),
    }))
    .filter((step) => step.title && step.body && step.targetSelector)
    .sort((a, b) => a.order - b.order)
    .map((step, idx) => ({ ...step, order: idx + 1 }));
  if (steps.length === 0) throw new Error("tour_steps_required");

  return {
    key,
    name,
    surface: surface as ProductTourSurface,
    status,
    locale,
    title: input.title ? String(input.title) : null,
    description: input.description ? String(input.description) : null,
    condition: condition ?? null,
    triggerType: triggerType as ProductTourTriggerType,
    triggerConfig: triggerConfig ?? null,
    installationId: input.installationId ? String(input.installationId) : null,
    steps,
  };
}

export async function upsertProductTour(
  prisma: AnyPrisma,
  input: Parameters<typeof normalizeProductTourInput>[0] & { actor?: string | null; tourId?: string | null },
) {
  const normalized = normalizeProductTourInput(input);
  const actor = input.actor ? String(input.actor) : null;

  const existing =
    input.tourId
      ? await prisma.productTour.findUnique({ where: { id: String(input.tourId) } })
      : await prisma.productTour.findUnique({ where: { key: normalized.key } });

  let tour;
  if (existing) {
    tour = await prisma.productTour.update({
      where: { id: existing.id },
      data: {
        key: normalized.key,
        name: normalized.name,
        surface: normalized.surface,
        status: normalized.status,
        locale: normalized.locale,
        title: normalized.title,
        description: normalized.description,
        condition: normalized.condition,
        triggerType: normalized.triggerType,
        triggerConfig: normalized.triggerConfig,
        installationId: normalized.installationId,
        updatedBy: actor,
      },
    });
    await prisma.productTourStep.deleteMany({ where: { tourId: tour.id } });
  } else {
    tour = await prisma.productTour.create({
      data: {
        key: normalized.key,
        name: normalized.name,
        surface: normalized.surface,
        status: normalized.status,
        locale: normalized.locale,
        title: normalized.title,
        description: normalized.description,
        condition: normalized.condition,
        triggerType: normalized.triggerType,
        triggerConfig: normalized.triggerConfig,
        installationId: normalized.installationId,
        createdBy: actor,
        updatedBy: actor,
      },
    });
  }

  if (normalized.steps.length > 0) {
    await prisma.productTourStep.createMany({
      data: normalized.steps.map((step) => ({
        tourId: tour.id,
        order: step.order,
        locale: step.locale,
        title: step.title,
        body: step.body,
        targetSelector: step.targetSelector,
        placement: step.placement,
        condition: step.condition ?? null,
      })),
    });
  }
  return prisma.productTour.findUnique({
    where: { id: tour.id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export async function loadProductToursAdmin(prisma: AnyPrisma) {
  const [tours, stats30d] = await Promise.all([
    prisma.productTour.findMany({
      include: { steps: { orderBy: { order: "asc" } }, installation: { select: { instanceId: true, clientName: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    }),
    prisma.productTourEvent.groupBy({
      by: ["tourId", "eventType"],
      _count: { _all: true },
      where: { occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }).catch(() => []),
  ]);

  const statMap = new Map<string, { started: number; completed: number; abandoned: number }>();
  for (const row of stats30d as any[]) {
    const bucket = statMap.get(row.tourId) ?? { started: 0, completed: 0, abandoned: 0 };
    const key = String(row.eventType).toLowerCase();
    if (key === "started") bucket.started = Number(row._count?._all ?? 0);
    if (key === "completed") bucket.completed = Number(row._count?._all ?? 0);
    if (key === "abandoned") bucket.abandoned = Number(row._count?._all ?? 0);
    statMap.set(row.tourId, bucket);
  }

  return {
    generatedAt: new Date().toISOString(),
    tours: (tours as any[]).map((tour) => ({
      ...tour,
      stats30d: statMap.get(tour.id) ?? { started: 0, completed: 0, abandoned: 0 },
    })),
  };
}

export async function loadProductToursForRuntime(
  prisma: AnyPrisma,
  ctx: PublicTourContext & { instanceId?: string | null },
) {
  const locale = normalizeLocale(ctx.locale);
  let installationId: string | null = null;
  if (ctx.instanceId) {
    const installation = await prisma.installation.findUnique({
      where: { instanceId: String(ctx.instanceId) },
      select: { id: true },
    }).catch(() => null);
    installationId = installation?.id ?? null;
  }

  const tours = await prisma.productTour.findMany({
    where: {
      surface: String(ctx.surface).toUpperCase(),
      status: "ACTIVE",
      locale,
      OR: [{ installationId: null }, ...(installationId ? [{ installationId }] : [])],
    },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: [{ installationId: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return (tours as any[])
    .filter((tour) => evaluateCondition(parseJsonObject<TourCondition>(tour.condition), ctx))
    .filter((tour) => evaluateTrigger(tour.triggerType, parseJsonObject<TourTriggerConfig>(tour.triggerConfig), ctx, tour.key))
    .map((tour) => ({
      id: tour.id,
      key: tour.key,
      name: tour.name,
      surface: tour.surface,
      status: tour.status,
      locale: tour.locale,
      title: tour.title ?? null,
      description: tour.description ?? null,
      condition: tour.condition ?? null,
      trigger:
        tour.triggerType === "FEATURE_UNUSED"
          ? { kind: "FEATURE_UNUSED", ...(parseJsonObject<TourTriggerConfig>(tour.triggerConfig) ?? {}) }
          : tour.triggerType === "TRIAL_NEARING_END"
            ? { kind: "TRIAL_NEARING_END", ...(parseJsonObject<TourTriggerConfig>(tour.triggerConfig) ?? {}) }
            : { kind: tour.triggerType },
      steps: (tour.steps ?? [])
        .filter((step: any) => !step.locale || normalizeLocale(step.locale) === locale)
        .filter((step: any) => evaluateCondition(parseJsonObject<TourCondition>(step.condition), ctx))
        .map((step: any) => ({
          id: step.id,
          order: step.order,
          locale: step.locale,
          title: step.title,
          body: step.body,
          targetSelector: step.targetSelector,
          placement: step.placement,
          condition: step.condition ?? null,
        })),
    }))
    .filter((tour) => tour.steps.length > 0);
}

export async function trackProductTourEvent(
  prisma: AnyPrisma,
  input: {
    instanceId?: string | null;
    companyId?: string | null;
    userId?: string | null;
    role?: string | null;
    icp?: string | null;
    locale?: string | null;
    surface: "ADMIN" | "STOREFRONT";
    eventType: "STARTED" | "COMPLETED" | "ABANDONED";
    tourId?: string | null;
    tourKey?: string | null;
    sessionId?: string | null;
    stepIndex?: number | null;
    stepId?: string | null;
    path?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const eventType = String(input.eventType ?? "").toUpperCase();
  if (!["STARTED", "COMPLETED", "ABANDONED"].includes(eventType)) throw new Error("invalid_event_type");
  const surface = String(input.surface ?? "").toUpperCase();
  if (!["ADMIN", "STOREFRONT"].includes(surface)) throw new Error("invalid_surface");

  const tour =
    input.tourId
      ? await prisma.productTour.findUnique({ where: { id: String(input.tourId) } })
      : input.tourKey
        ? await prisma.productTour.findUnique({ where: { key: String(input.tourKey) } })
        : null;
  if (!tour) throw new Error("tour_not_found");

  const installation =
    input.instanceId
      ? await prisma.installation.findUnique({ where: { instanceId: String(input.instanceId) }, select: { id: true } }).catch(() => null)
      : null;

  const occurredAt = new Date();
  const row = await prisma.productTourEvent.create({
    data: {
      tourId: tour.id,
      installationId: installation?.id ?? null,
      instanceId: input.instanceId ? String(input.instanceId) : null,
      companyId: input.companyId ? String(input.companyId) : null,
      userId: input.userId ? String(input.userId) : null,
      role: input.role ? String(input.role) : null,
      icp: input.icp ? String(input.icp) : null,
      locale: input.locale ? normalizeLocale(input.locale) : null,
      surface: surface as ProductTourSurface,
      eventType: eventType as any,
      sessionId: input.sessionId ? String(input.sessionId) : null,
      stepIndex: input.stepIndex == null ? null : Number(input.stepIndex),
      stepId: input.stepId ? String(input.stepId) : null,
      path: input.path ? String(input.path) : null,
      metadata: (input.metadata ?? null) as any,
      occurredAt,
    },
  });

  if (installation?.id) {
    const evidencePayload = {
      kind: "product_tour_event",
      installationId: installation.id,
      instanceId: input.instanceId ?? null,
      tourId: tour.id,
      tourKey: tour.key,
      eventType,
      surface,
      occurredAt: occurredAt.toISOString(),
    };
    await prisma.complianceEvidence.create({
      data: {
        installationId: installation.id,
        controlId: null,
        evidenceType: "product_tour.event",
        source: "control-plane",
        payload: evidencePayload as any,
        payloadHash: hashEvidencePayload(evidencePayload),
        sourceCapturedAt: occurredAt,
        capturedBy: "product-tours",
        tags: ["product-tours", "tracking"],
      },
    }).catch(() => null);
  }

  return row;
}

export async function loadProductToursDashboard(prisma: AnyPrisma, options?: { take?: number }) {
  const [admin, recentEvents, activation] = await Promise.all([
    loadProductToursAdmin(prisma),
    prisma.productTourEvent.findMany({
      include: { tour: { select: { key: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: Math.min(1000, Math.max(50, Number(options?.take ?? 300))),
    }),
    loadActivationScoresDashboard(prisma as any, { take: 500 }).catch(() => null),
  ]);

  const byTour = new Map<string, { started: number; completed: number; abandoned: number; instancesCompleted: Set<string> }>();
  for (const evt of recentEvents as any[]) {
    const bucket = byTour.get(evt.tourId) ?? { started: 0, completed: 0, abandoned: 0, instancesCompleted: new Set<string>() };
    const t = String(evt.eventType).toUpperCase();
    if (t === "STARTED") bucket.started += 1;
    else if (t === "COMPLETED") {
      bucket.completed += 1;
      if (evt.instanceId) bucket.instancesCompleted.add(String(evt.instanceId));
    } else if (t === "ABANDONED") bucket.abandoned += 1;
    byTour.set(evt.tourId, bucket);
  }

  const activationByInstance = new Map<string, any>();
  for (const item of activation?.items ?? []) activationByInstance.set(item.instanceId, item);

  const tourImpact = (admin.tours ?? []).map((tour: any) => {
    const stats = byTour.get(tour.id) ?? { started: 0, completed: 0, abandoned: 0, instancesCompleted: new Set<string>() };
    const completedScores = [...stats.instancesCompleted]
      .map((iid) => activationByInstance.get(iid))
      .filter(Boolean)
      .map((item) => Number(item.score ?? 0));
    const avgActivationScoreCompleted =
      completedScores.length > 0
        ? Number((completedScores.reduce((a, b) => a + b, 0) / completedScores.length).toFixed(1))
        : null;
    return {
      tourId: tour.id,
      key: tour.key,
      name: tour.name,
      surface: tour.surface,
      started: stats.started,
      completed: stats.completed,
      abandoned: stats.abandoned,
      completionRate: stats.started > 0 ? Number(((stats.completed / stats.started) * 100).toFixed(1)) : 0,
      avgActivationScoreCompleted,
      completedInstancesCount: stats.instancesCompleted.size,
    };
  });

  return {
    ...admin,
    recentEvents,
    impact: {
      activationSampleSize: activation?.items?.length ?? 0,
      tours: tourImpact.sort((a, b) => b.completionRate - a.completionRate || a.key.localeCompare(b.key)),
    },
  };
}
