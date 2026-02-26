import type { PrismaClient } from "./generated/prisma";

export type ActivationState = "NOT_ACTIVATED" | "ACTIVATING" | "ACTIVATED";

export type ActivationSignalKey =
  | "catalog_imported"
  | "mercadopago_connected"
  | "first_sale"
  | "first_order_online"
  | "printing_ok"
  | "first_route"
  | "first_email_campaign";

export type ActivationSignal = {
  key: ActivationSignalKey;
  label: string;
  weight: number;
  detected: boolean;
  source: string;
  details?: Record<string, any>;
};

export type ActivationInstanceInput = {
  installationId: string;
  instanceId: string;
  clientName?: string | null;
  domain?: string | null;
  healthStatus?: string | null;
  searchOk?: boolean | null;
  billingAccountId?: string | null;
  planName?: string | null;
  provider?: string | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  monthlyOrders?: number | null;
  monthlyGmvArs?: number | null;
  businessType?: string | null;
  trialEvents?: Array<{ eventType: string; eventAt: Date; properties?: any }>;
  featureUsage?: Array<{ feature: string; action: string; count: number }>;
  recentPlaybookRuns?: Array<{ playbookKey: string; createdAt: Date; status?: string | null }>;
};

export type ActivationInstanceScore = {
  installationId: string;
  instanceId: string;
  clientName?: string | null;
  domain?: string | null;
  businessType?: string | null;
  planName?: string | null;
  provider?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  trialAgeDaysBa: number | null;
  trialDaysRemainingBa: number | null;
  score: number;
  state: ActivationState;
  signals: ActivationSignal[];
  stuckAlerts: Array<{ code: string; level: "warning" | "danger"; message: string }>;
  summary: {
    detectedCount: number;
    totalSignals: number;
    featureUsageTotal: number;
    recentPlaybooks: string[];
  };
};

const SIGNAL_WEIGHTS: Array<{ key: ActivationSignalKey; label: string; weight: number }> = [
  { key: "catalog_imported", label: "Catálogo importado / usable", weight: 20 },
  { key: "mercadopago_connected", label: "Mercado Pago conectado", weight: 20 },
  { key: "first_sale", label: "Primera venta", weight: 20 },
  { key: "first_order_online", label: "Primera orden online", weight: 10 },
  { key: "printing_ok", label: "Impresión/escáner OK", weight: 10 },
  { key: "first_route", label: "Primera ruta de reparto", weight: 10 },
  { key: "first_email_campaign", label: "Primera campaña email", weight: 10 },
];

export function baDayKey(date: Date | string) {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function baDayDiff(from: Date | string, to: Date | string) {
  const a = new Date(`${baDayKey(from)}T00:00:00-03:00`);
  const b = new Date(`${baDayKey(to)}T00:00:00-03:00`);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeFeatureUsage(rows: ActivationInstanceInput["featureUsage"] = []) {
  const byFeature = new Map<string, number>();
  const byPair = new Map<string, number>();
  let total = 0;
  for (const row of rows ?? []) {
    const feature = String(row.feature ?? "").toLowerCase();
    const action = String(row.action ?? "").toLowerCase();
    const count = Math.max(0, Number(row.count ?? 0));
    total += count;
    byFeature.set(feature, (byFeature.get(feature) ?? 0) + count);
    byPair.set(`${feature}:${action}`, (byPair.get(`${feature}:${action}`) ?? 0) + count);
  }
  return { byFeature, byPair, total };
}

function hasTrialEvent(input: ActivationInstanceInput, eventType: string) {
  return (input.trialEvents ?? []).some((evt) => evt.eventType === eventType);
}

function computeSignals(input: ActivationInstanceInput): ActivationSignal[] {
  const usage = normalizeFeatureUsage(input.featureUsage);
  const recentPlaybooks = new Set((input.recentPlaybookRuns ?? []).map((r) => r.playbookKey));
  const monthlyOrders = Math.max(0, Number(input.monthlyOrders ?? 0));
  const bt = String(input.businessType ?? "").toLowerCase();
  const provider = String(input.provider ?? "").toUpperCase();

  const hasPos = (usage.byFeature.get("pos") ?? 0) > 0;
  const hasSearch = (usage.byFeature.get("search") ?? 0) > 0;
  const hasCampaigns = (usage.byFeature.get("campaigns") ?? 0) > 0;
  const hasEmailTemplates = (usage.byFeature.get("email_templates") ?? 0) > 0;
  const hasIntegrations = (usage.byFeature.get("integrations") ?? 0) > 0;
  const hasRouteFeature = (usage.byFeature.get("fulfillment") ?? 0) > 0 || (usage.byFeature.get("delivery_routing") ?? 0) > 0;
  const hasRouteAction =
    [...usage.byPair.keys()].some((k) => k.includes("route")) ||
    (usage.byPair.get("integrations:view") ?? 0) > 0;

  const catalogImported =
    hasSearch ||
    (hasPos && monthlyOrders >= 0) ||
    (usage.byFeature.get("starter_packs") ?? 0) > 0 ||
    !recentPlaybooks.has("D3_NO_CATALOG_IMPORT");
  const mpConnected =
    provider === "MERCADOPAGO" ||
    hasTrialEvent(input, "PaymentMethodAdded") ||
    hasTrialEvent(input, "ConvertedToPaid") ||
    (hasIntegrations && [...usage.byPair.keys()].some((k) => k.includes("mercado")));
  const firstSale = monthlyOrders > 0 || hasTrialEvent(input, "ConvertedToPaid");
  const firstOrderOnline =
    hasIntegrations ||
    hasTrialEvent(input, "ConvertedToPaid") ||
    [...usage.byPair.keys()].some((k) => k.includes("checkout") || k.includes("storefront"));
  const printingOk =
    hasPos &&
    (monthlyOrders > 0 ||
      [...usage.byPair.keys()].some((k) => k.includes("print") || k.includes("scanner")) ||
      !recentPlaybooks.has("D7_NO_FIRST_SALE_POS_NUDGE"));
  const firstRoute =
    hasRouteFeature ||
    hasRouteAction ||
    (bt.includes("distrib") && monthlyOrders > 0 && (usage.byFeature.get("integrations") ?? 0) > 0);
  const firstEmailCampaign =
    hasCampaigns ||
    hasEmailTemplates ||
    [...usage.byPair.keys()].some((k) => k.startsWith("campaigns:") || k.startsWith("email_templates:"));

  const detected: Record<ActivationSignalKey, { detected: boolean; source: string; details?: Record<string, any> }> = {
    catalog_imported: {
      detected: Boolean(catalogImported),
      source: hasSearch || hasPos ? "feature_usage" : !recentPlaybooks.has("D3_NO_CATALOG_IMPORT") ? "playbook_negative_signal" : "none",
      details: { hasSearch, hasPos, recentD3NoCatalogPlaybook: recentPlaybooks.has("D3_NO_CATALOG_IMPORT") },
    },
    mercadopago_connected: {
      detected: Boolean(mpConnected),
      source: provider === "MERCADOPAGO" ? "billing_provider" : hasTrialEvent(input, "PaymentMethodAdded") ? "trial_lifecycle_event" : "none",
      details: { provider, paymentMethodAdded: hasTrialEvent(input, "PaymentMethodAdded") },
    },
    first_sale: {
      detected: Boolean(firstSale),
      source: monthlyOrders > 0 ? "billing_usage" : hasTrialEvent(input, "ConvertedToPaid") ? "trial_lifecycle_event" : "none",
      details: { monthlyOrders },
    },
    first_order_online: {
      detected: Boolean(firstOrderOnline),
      source: hasIntegrations ? "feature_usage" : hasTrialEvent(input, "ConvertedToPaid") ? "trial_lifecycle_event_proxy" : "none",
      details: { hasIntegrations },
    },
    printing_ok: {
      detected: Boolean(printingOk),
      source: monthlyOrders > 0 && hasPos ? "pos_usage_proxy" : "feature_usage",
      details: { hasPos, monthlyOrders },
    },
    first_route: {
      detected: Boolean(firstRoute),
      source: hasRouteFeature || hasRouteAction ? "feature_usage" : "none",
      details: { hasRouteFeature, hasRouteAction, businessType: bt || null },
    },
    first_email_campaign: {
      detected: Boolean(firstEmailCampaign),
      source: hasCampaigns || hasEmailTemplates ? "feature_usage" : "none",
      details: { hasCampaigns, hasEmailTemplates },
    },
  };

  return SIGNAL_WEIGHTS.map((row) => ({
    ...row,
    detected: detected[row.key].detected,
    source: detected[row.key].source,
    details: detected[row.key].details,
  }));
}

export function scoreActivationInstance(input: ActivationInstanceInput, now = new Date()): ActivationInstanceScore {
  const signals = computeSignals(input);
  const score = signals.reduce((sum, signal) => sum + (signal.detected ? signal.weight : 0), 0);
  const state: ActivationState = score >= 75 ? "ACTIVATED" : score >= 35 ? "ACTIVATING" : "NOT_ACTIVATED";
  const trialAgeDaysBa = input.trialStartedAt ? baDayDiff(input.trialStartedAt, now) : null;
  const trialDaysRemainingBa = input.trialEndsAt ? baDayDiff(now, input.trialEndsAt) : null;
  const featureUsageTotal = normalizeFeatureUsage(input.featureUsage).total;

  const stuckAlerts: Array<{ code: string; level: "warning" | "danger"; message: string }> = [];
  if (trialAgeDaysBa != null) {
    if (trialAgeDaysBa >= 7 && score < 35) {
      stuckAlerts.push({
        code: "STUCK_WEEK1_NOT_ACTIVATED",
        level: "warning",
        message: `Trial con ${trialAgeDaysBa} días y score ${score}: sigue sin activación básica.`,
      });
    }
    if (trialAgeDaysBa >= 14 && score < 60) {
      stuckAlerts.push({
        code: "STUCK_WEEK2_LOW_PROGRESS",
        level: "danger",
        message: `Trial con ${trialAgeDaysBa} días y score ${score}: progreso insuficiente hacia activación.`,
      });
    }
  }
  if (trialDaysRemainingBa != null && trialDaysRemainingBa <= 3 && score < 75) {
    stuckAlerts.push({
      code: "TRIAL_ENDING_LOW_ACTIVATION",
      level: "danger",
      message: `Faltan ${trialDaysRemainingBa} días para fin de trial y score ${score}.`,
    });
  }

  return {
    installationId: input.installationId,
    instanceId: input.instanceId,
    clientName: input.clientName ?? null,
    domain: input.domain ?? null,
    businessType: input.businessType ?? null,
    planName: input.planName ?? null,
    provider: input.provider ?? null,
    trialStartedAt: input.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: input.trialEndsAt?.toISOString() ?? null,
    trialAgeDaysBa,
    trialDaysRemainingBa,
    score,
    state,
    signals,
    stuckAlerts,
    summary: {
      detectedCount: signals.filter((s) => s.detected).length,
      totalSignals: signals.length,
      featureUsageTotal,
      recentPlaybooks: (input.recentPlaybookRuns ?? []).slice(0, 10).map((r) => r.playbookKey),
    },
  };
}

export async function loadActivationScoresDashboard(prisma: PrismaClient, options?: { take?: number; now?: Date; instanceId?: string | null }) {
  const now = options?.now ?? new Date();
  const take = Math.min(500, Math.max(1, Number(options?.take ?? 200)));
  const instanceIdFilter = (options?.instanceId ?? "").trim();

  const installations = await (prisma as any).installation.findMany({
    where: instanceIdFilter ? { instanceId: { contains: instanceIdFilter } } : undefined,
    orderBy: [{ lastSeenAt: "desc" }, { updatedAt: "desc" }],
    take,
    select: {
      id: true,
      instanceId: true,
      clientName: true,
      domain: true,
      healthStatus: true,
      searchOk: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  const instanceIds = installations.map((i: any) => i.instanceId);

  const [billingAccounts, featureUsageRows, playbookRuns, trialEvents, redemptions, leadAttributions] = await Promise.all([
    instanceIds.length
      ? (prisma as any).billingAccount.findMany({
          where: { instanceId: { in: instanceIds } },
          include: { plan: true },
        })
      : Promise.resolve([]),
    instanceIds.length
      ? (prisma as any).featureUsageSample.findMany({
          where: {
            instanceId: { in: instanceIds },
            capturedAt: { gte: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { capturedAt: "desc" },
          take: 50_000,
        })
      : Promise.resolve([]),
    instanceIds.length
      ? (prisma as any).trialPlaybookRun.findMany({
          where: { instanceId: { in: instanceIds }, createdAt: { gte: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) } },
          orderBy: { createdAt: "desc" },
          take: 10_000,
        })
      : Promise.resolve([]),
    instanceIds.length
      ? (prisma as any).trialLifecycleEvent.findMany({
          where: { instanceId: { in: instanceIds } },
          orderBy: { eventAt: "asc" },
          take: 20_000,
        })
      : Promise.resolve([]),
    instanceIds.length
      ? (prisma as any).trialRedemption.findMany({
          where: { instanceId: { in: instanceIds } },
          orderBy: { redeemedAt: "desc" },
          take: 10_000,
        })
      : Promise.resolve([]),
    [] as any[],
  ]);

  const latestRedemptionByInstance = new Map<string, any>();
  for (const row of redemptions as any[]) {
    if (!row.instanceId) continue;
    if (!latestRedemptionByInstance.has(row.instanceId)) latestRedemptionByInstance.set(row.instanceId, row);
  }
  const redemptionIds = Array.from(new Set((redemptions as any[]).map((r) => r.id)));
  const resolvedLeadAttributions =
    redemptionIds.length > 0
      ? await (prisma as any).leadAttribution.findMany({
          where: { redemptionId: { in: redemptionIds } },
          orderBy: { createdAt: "desc" },
          take: 10_000,
        })
      : leadAttributions;
  const leadByRedemption = new Map<string, any>();
  for (const lead of resolvedLeadAttributions as any[]) {
    if (!lead.redemptionId) continue;
    if (!leadByRedemption.has(lead.redemptionId)) leadByRedemption.set(lead.redemptionId, lead);
  }

  const billingByInstance = new Map<string, any>();
  for (const account of billingAccounts as any[]) billingByInstance.set(account.instanceId, account);
  const usageByInstance = new Map<string, any[]>();
  for (const row of featureUsageRows as any[]) {
    const arr = usageByInstance.get(row.instanceId) ?? [];
    arr.push(row);
    usageByInstance.set(row.instanceId, arr);
  }
  const playbooksByInstance = new Map<string, any[]>();
  for (const row of playbookRuns as any[]) {
    if (!row.instanceId) continue;
    const arr = playbooksByInstance.get(row.instanceId) ?? [];
    arr.push(row);
    playbooksByInstance.set(row.instanceId, arr);
  }
  const eventsByInstance = new Map<string, any[]>();
  for (const evt of trialEvents as any[]) {
    if (!evt.instanceId) continue;
    const arr = eventsByInstance.get(evt.instanceId) ?? [];
    arr.push(evt);
    eventsByInstance.set(evt.instanceId, arr);
  }

  const items: ActivationInstanceScore[] = installations.map((inst: any) => {
    const account = billingByInstance.get(inst.instanceId);
    const latestRedemption = latestRedemptionByInstance.get(inst.instanceId);
    const lead = latestRedemption?.id ? leadByRedemption.get(latestRedemption.id) : null;
    return scoreActivationInstance(
      {
        installationId: inst.id,
        instanceId: inst.instanceId,
        clientName: inst.clientName ?? null,
        domain: inst.domain ?? null,
        healthStatus: inst.healthStatus ?? null,
        searchOk: inst.searchOk ?? null,
        billingAccountId: account?.id ?? null,
        planName: account?.plan?.name ?? null,
        provider: account?.provider ?? null,
        trialStartedAt:
          (eventsByInstance.get(inst.instanceId) ?? []).find((e: any) => e.eventType === "TrialStarted")?.eventAt ??
          account?.createdAt ??
          inst.createdAt,
        trialEndsAt: account?.trialEndsAt ?? null,
        monthlyOrders: account?.monthlyOrders ?? 0,
        monthlyGmvArs: account?.monthlyGmvArs ?? 0,
        businessType: lead?.businessType ?? null,
        trialEvents: (eventsByInstance.get(inst.instanceId) ?? []).map((evt: any) => ({
          eventType: String(evt.eventType),
          eventAt: evt.eventAt,
          properties: evt.properties ?? null,
        })),
        featureUsage: (usageByInstance.get(inst.instanceId) ?? []).map((row: any) => ({
          feature: String(row.feature),
          action: String(row.action),
          count: Number(row.count),
        })),
        recentPlaybookRuns: (playbooksByInstance.get(inst.instanceId) ?? []).map((row: any) => ({
          playbookKey: String(row.playbookKey),
          createdAt: row.createdAt,
          status: row.status ?? null,
        })),
      },
      now,
    );
  });

  const summary = items.reduce(
    (
      acc: {
        total: number;
        avgScore: number;
        stuck: number;
        byState: { notActivated: number; activating: number; activated: number };
      },
      item: ActivationInstanceScore,
    ) => {
      acc.total += 1;
      acc.avgScore += item.score;
      if (item.state === "NOT_ACTIVATED") acc.byState.notActivated += 1;
      else if (item.state === "ACTIVATING") acc.byState.activating += 1;
      else acc.byState.activated += 1;
      if (item.stuckAlerts.length > 0) acc.stuck += 1;
      return acc;
    },
    {
      total: 0,
      avgScore: 0,
      stuck: 0,
      byState: { notActivated: 0, activating: 0, activated: 0 },
    },
  );
  summary.avgScore = summary.total ? Number((summary.avgScore / summary.total).toFixed(1)) : 0;

  const stuckAlerts = items
    .flatMap((item) =>
      item.stuckAlerts.map((alert) => ({
        ...alert,
        instanceId: item.instanceId,
        installationId: item.installationId,
        clientName: item.clientName,
        score: item.score,
        state: item.state,
        trialAgeDaysBa: item.trialAgeDaysBa,
        trialDaysRemainingBa: item.trialDaysRemainingBa,
      })),
    )
    .sort((a, b) => {
      const severity = (x: string) => (x === "danger" ? 2 : 1);
      return severity(b.level) - severity(a.level) || a.score - b.score;
    });

  return {
    generatedAt: now.toISOString(),
    summary,
    stuckAlerts,
    items: items.sort((a, b) => a.score - b.score || a.instanceId.localeCompare(b.instanceId)),
  };
}
