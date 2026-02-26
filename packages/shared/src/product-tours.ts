export type TourSurface = "ADMIN" | "STOREFRONT";
export type TourLocale = "es" | "en";
export type TourStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type TourTrackEventType = "STARTED" | "COMPLETED" | "ABANDONED";

export type TourCondition = {
  rolesIn?: string[];
  icpIn?: string[];
  localesIn?: string[];
  surfacesIn?: TourSurface[];
  pathPrefixes?: string[];
};

export type TourTrigger =
  | { kind: "FIRST_TIME" }
  | { kind: "FEATURE_UNUSED"; featureKey: string; minCount?: number }
  | { kind: "TRIAL_NEARING_END"; daysRemainingLte: number }
  | { kind: "ALWAYS" };

export type ProductTourStepDefinition = {
  id: string;
  title: string;
  body: string;
  targetSelector: string;
  locale?: TourLocale | string | null;
  order: number;
  condition?: TourCondition | null;
};

export type ProductTourDefinition = {
  id: string;
  key: string;
  name: string;
  surface: TourSurface;
  locale: TourLocale | string;
  status: TourStatus | string;
  condition?: TourCondition | null;
  trigger?: TourTrigger | null;
  steps: ProductTourStepDefinition[];
};

export type ProductTourRuntimeContext = {
  surface: TourSurface;
  locale?: string | null;
  role?: string | null;
  icp?: string | null;
  path?: string | null;
  trialDaysRemaining?: number | null;
  featureUsage?: Record<string, number> | null;
  seenTourKeys?: string[] | null;
  completedTourKeys?: string[] | null;
};

export type ProductTourTrackingPayload = {
  tourId: string;
  tourKey: string;
  eventType: TourTrackEventType;
  surface: TourSurface;
  locale?: string | null;
  role?: string | null;
  icp?: string | null;
  stepIndex?: number | null;
  stepId?: string | null;
  sessionId?: string | null;
  instanceId?: string | null;
  userId?: string | null;
  path?: string | null;
};

export function normalizeTourLocale(input: string | null | undefined): TourLocale {
  const v = String(input ?? "es").toLowerCase();
  return v.startsWith("en") ? "en" : "es";
}

function normalizeList(items?: string[] | null) {
  return Array.from(new Set((items ?? []).map((v) => String(v).trim()).filter(Boolean)));
}

export function evaluateTourCondition(condition: TourCondition | null | undefined, ctx: ProductTourRuntimeContext) {
  if (!condition) return true;
  const role = String(ctx.role ?? "").toLowerCase();
  const icp = String(ctx.icp ?? "").toLowerCase();
  const locale = normalizeTourLocale(ctx.locale);
  const path = String(ctx.path ?? "");
  const surface = ctx.surface;

  const rolesIn = normalizeList(condition.rolesIn).map((v) => v.toLowerCase());
  if (rolesIn.length > 0 && !rolesIn.includes(role)) return false;
  const icpIn = normalizeList(condition.icpIn).map((v) => v.toLowerCase());
  if (icpIn.length > 0 && !icpIn.includes(icp)) return false;
  const localesIn = normalizeList(condition.localesIn).map((v) => normalizeTourLocale(v));
  if (localesIn.length > 0 && !localesIn.includes(locale)) return false;
  const surfacesIn = (condition.surfacesIn ?? []).map((v) => String(v).toUpperCase());
  if (surfacesIn.length > 0 && !surfacesIn.includes(surface)) return false;
  const prefixes = normalizeList(condition.pathPrefixes);
  if (prefixes.length > 0 && !prefixes.some((prefix) => path.startsWith(prefix))) return false;

  return true;
}

export function evaluateTourTrigger(trigger: TourTrigger | null | undefined, ctx: ProductTourRuntimeContext, tour: { key: string }) {
  if (!trigger || trigger.kind === "ALWAYS") return true;
  if (trigger.kind === "FIRST_TIME") {
    const seen = new Set((ctx.seenTourKeys ?? []).map((v) => String(v)));
    const completed = new Set((ctx.completedTourKeys ?? []).map((v) => String(v)));
    return !seen.has(tour.key) && !completed.has(tour.key);
  }
  if (trigger.kind === "FEATURE_UNUSED") {
    const count = Number(ctx.featureUsage?.[trigger.featureKey] ?? 0);
    const minCount = Math.max(0, Number(trigger.minCount ?? 1));
    return count < minCount;
  }
  if (trigger.kind === "TRIAL_NEARING_END") {
    if (ctx.trialDaysRemaining == null) return false;
    return Number(ctx.trialDaysRemaining) <= Number(trigger.daysRemainingLte);
  }
  return false;
}

export function selectToursForRuntime(tours: ProductTourDefinition[], ctx: ProductTourRuntimeContext) {
  const locale = normalizeTourLocale(ctx.locale);
  return tours
    .filter((tour) => String(tour.status ?? "").toUpperCase() === "ACTIVE")
    .filter((tour) => String(tour.surface).toUpperCase() === String(ctx.surface).toUpperCase())
    .filter((tour) => normalizeTourLocale(String(tour.locale ?? "es")) === locale)
    .filter((tour) => evaluateTourCondition(tour.condition, ctx))
    .filter((tour) => evaluateTourTrigger(tour.trigger ?? null, ctx, { key: tour.key }))
    .map((tour) => ({
      ...tour,
      steps: [...(tour.steps ?? [])]
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .filter((step) => evaluateTourCondition(step.condition ?? null, ctx))
        .filter((step) => {
          const stepLocale = step.locale ? normalizeTourLocale(step.locale) : locale;
          return stepLocale === locale;
        }),
    }))
    .filter((tour) => tour.steps.length > 0);
}

export function buildTourTrackingEvent(payload: ProductTourTrackingPayload) {
  const eventName =
    payload.eventType === "COMPLETED"
      ? "TourCompleted"
      : payload.eventType === "ABANDONED"
        ? "TourAbandoned"
        : "TourStarted";
  return {
    id: `${payload.tourKey}:${payload.eventType}:${payload.sessionId ?? "session"}:${Date.now()}`,
    name: eventName,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    source: payload.surface === "ADMIN" ? "admin" : "storefront",
    payload: {
      tourId: payload.tourId,
      tourKey: payload.tourKey,
      eventType: payload.eventType,
      surface: payload.surface,
      locale: payload.locale ?? null,
      role: payload.role ?? null,
      icp: payload.icp ?? null,
      stepIndex: payload.stepIndex ?? null,
      stepId: payload.stepId ?? null,
      sessionId: payload.sessionId ?? null,
      instanceId: payload.instanceId ?? null,
      userId: payload.userId ?? null,
      path: payload.path ?? null,
    },
  };
}

