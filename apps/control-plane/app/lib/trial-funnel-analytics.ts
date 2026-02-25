import type { PrismaClient } from "./generated/prisma";
import { parseBaDateRange } from "./partner-program";

export type TrialLifecycleEventName =
  | "TrialStarted"
  | "TrialExtended"
  | "TrialExpired"
  | "PaymentMethodAdded"
  | "ConvertedToPaid"
  | "BecamePastDue"
  | "BecameRestricted";

export type TrialAnalyticsEventRow = {
  eventType: TrialLifecycleEventName;
  eventAt: Date;
  campaignId?: string | null;
  campaignCode?: string | null;
  campaignTier?: string | null;
  billingAccountId?: string | null;
  instanceId?: string | null;
  businessType?: string | null;
};

export type TrialAnalyticsLeadRow = {
  createdAt: Date;
  campaignId?: string | null;
  campaignCode?: string | null;
  campaignTier?: string | null;
  businessType?: string | null;
};

export function dayKeyBa(input: Date | string) {
  const date = new Date(input);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function safeBusinessType(value?: string | null) {
  const raw = String(value ?? "").trim();
  return raw || "UNKNOWN";
}

function getOrInit<K, V>(map: Map<K, V>, key: K, factory: () => V) {
  const current = map.get(key);
  if (current) return current;
  const next = factory();
  map.set(key, next);
  return next;
}

export function aggregateTrialFunnelAnalytics(input: {
  leads: TrialAnalyticsLeadRow[];
  events: TrialAnalyticsEventRow[];
}) {
  const funnelByCampaign = new Map<
    string,
    {
      campaignId: string | null;
      campaignCode: string;
      campaignTier: string | null;
      signups: number;
      trialStarted: number;
      paymentMethodAdded: number;
      convertedToPaid: number;
      trialExpired: number;
      becamePastDue: number;
      becameRestricted: number;
      conversionRate: number;
      addPaymentRate: number;
    }
  >();
  const cohortRows = new Map<
    string,
    {
      cohortDate: string;
      starts: number;
      converted7d: number;
      converted14d: number;
      converted30d: number;
      rate7d: number;
      rate14d: number;
      rate30d: number;
    }
  >();
  const icpRows = new Map<
    string,
    {
      businessType: string;
      signups: number;
      trialStarted: number;
      convertedToPaid: number;
      conversionRate: number;
    }
  >();

  const trialStartByAccount = new Map<string, TrialAnalyticsEventRow>();

  for (const lead of input.leads) {
    const campaignKey = lead.campaignId ?? `code:${lead.campaignCode ?? "NO_CAMPAIGN"}`;
    const funnel = getOrInit(funnelByCampaign, campaignKey, () => ({
      campaignId: lead.campaignId ?? null,
      campaignCode: lead.campaignCode ?? "NO_CAMPAIGN",
      campaignTier: lead.campaignTier ?? null,
      signups: 0,
      trialStarted: 0,
      paymentMethodAdded: 0,
      convertedToPaid: 0,
      trialExpired: 0,
      becamePastDue: 0,
      becameRestricted: 0,
      conversionRate: 0,
      addPaymentRate: 0,
    }));
    funnel.signups += 1;

    const icp = getOrInit(icpRows, safeBusinessType(lead.businessType), () => ({
      businessType: safeBusinessType(lead.businessType),
      signups: 0,
      trialStarted: 0,
      convertedToPaid: 0,
      conversionRate: 0,
    }));
    icp.signups += 1;
  }

  const sortedEvents = [...input.events].sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
  for (const event of sortedEvents) {
    const campaignKey = event.campaignId ?? `code:${event.campaignCode ?? "NO_CAMPAIGN"}`;
    const funnel = getOrInit(funnelByCampaign, campaignKey, () => ({
      campaignId: event.campaignId ?? null,
      campaignCode: event.campaignCode ?? "NO_CAMPAIGN",
      campaignTier: event.campaignTier ?? null,
      signups: 0,
      trialStarted: 0,
      paymentMethodAdded: 0,
      convertedToPaid: 0,
      trialExpired: 0,
      becamePastDue: 0,
      becameRestricted: 0,
      conversionRate: 0,
      addPaymentRate: 0,
    }));

    if (event.eventType === "TrialStarted") {
      funnel.trialStarted += 1;
      const cohort = getOrInit(cohortRows, dayKeyBa(event.eventAt), () => ({
        cohortDate: dayKeyBa(event.eventAt),
        starts: 0,
        converted7d: 0,
        converted14d: 0,
        converted30d: 0,
        rate7d: 0,
        rate14d: 0,
        rate30d: 0,
      }));
      cohort.starts += 1;
      if (event.billingAccountId) {
        trialStartByAccount.set(event.billingAccountId, event);
      }
      const icp = getOrInit(icpRows, safeBusinessType(event.businessType), () => ({
        businessType: safeBusinessType(event.businessType),
        signups: 0,
        trialStarted: 0,
        convertedToPaid: 0,
        conversionRate: 0,
      }));
      icp.trialStarted += 1;
    }
    if (event.eventType === "PaymentMethodAdded") funnel.paymentMethodAdded += 1;
    if (event.eventType === "ConvertedToPaid") funnel.convertedToPaid += 1;
    if (event.eventType === "TrialExpired") funnel.trialExpired += 1;
    if (event.eventType === "BecamePastDue") funnel.becamePastDue += 1;
    if (event.eventType === "BecameRestricted") funnel.becameRestricted += 1;
  }

  // Cohort conversions and ICP conversions based on ConvertedToPaid event matched to TrialStarted.
  for (const event of sortedEvents) {
    if (event.eventType !== "ConvertedToPaid" || !event.billingAccountId) continue;
    const started = trialStartByAccount.get(event.billingAccountId);
    if (!started) continue;
    const diffDays = Math.floor((event.eventAt.getTime() - started.eventAt.getTime()) / (24 * 60 * 60 * 1000));
    const cohort = cohortRows.get(dayKeyBa(started.eventAt));
    if (cohort) {
      if (diffDays <= 7) cohort.converted7d += 1;
      if (diffDays <= 14) cohort.converted14d += 1;
      if (diffDays <= 30) cohort.converted30d += 1;
    }
    const icp = icpRows.get(safeBusinessType(started.businessType));
    if (icp) icp.convertedToPaid += 1;
  }

  const funnel = [...funnelByCampaign.values()]
    .map((row) => ({
      ...row,
      addPaymentRate: row.trialStarted > 0 ? Number(((row.paymentMethodAdded / row.trialStarted) * 100).toFixed(2)) : 0,
      conversionRate: row.trialStarted > 0 ? Number(((row.convertedToPaid / row.trialStarted) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.trialStarted - a.trialStarted || a.campaignCode.localeCompare(b.campaignCode));

  const cohorts = [...cohortRows.values()]
    .map((row) => ({
      ...row,
      rate7d: row.starts > 0 ? Number(((row.converted7d / row.starts) * 100).toFixed(2)) : 0,
      rate14d: row.starts > 0 ? Number(((row.converted14d / row.starts) * 100).toFixed(2)) : 0,
      rate30d: row.starts > 0 ? Number(((row.converted30d / row.starts) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.cohortDate.localeCompare(b.cohortDate));

  const icp = [...icpRows.values()]
    .map((row) => ({
      ...row,
      conversionRate: row.trialStarted > 0 ? Number(((row.convertedToPaid / row.trialStarted) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.trialStarted - a.trialStarted || a.businessType.localeCompare(b.businessType));

  const totals = funnel.reduce(
    (acc, row) => {
      acc.signups += row.signups;
      acc.trialStarted += row.trialStarted;
      acc.paymentMethodAdded += row.paymentMethodAdded;
      acc.convertedToPaid += row.convertedToPaid;
      acc.trialExpired += row.trialExpired;
      acc.becamePastDue += row.becamePastDue;
      acc.becameRestricted += row.becameRestricted;
      return acc;
    },
    {
      signups: 0,
      trialStarted: 0,
      paymentMethodAdded: 0,
      convertedToPaid: 0,
      trialExpired: 0,
      becamePastDue: 0,
      becameRestricted: 0,
    },
  );

  return {
    totals: {
      ...totals,
      addPaymentRate: totals.trialStarted > 0 ? Number(((totals.paymentMethodAdded / totals.trialStarted) * 100).toFixed(2)) : 0,
      conversionRate: totals.trialStarted > 0 ? Number(((totals.convertedToPaid / totals.trialStarted) * 100).toFixed(2)) : 0,
    },
    funnel,
    cohorts,
    icp,
  };
}

export async function recordTrialLifecycleEvent(
  prisma: PrismaClient,
  input: {
    eventType: TrialLifecycleEventName;
    eventAt?: Date;
    dedupeKey?: string | null;
    campaignId?: string | null;
    redemptionId?: string | null;
    billingAccountId?: string | null;
    installationId?: string | null;
    instanceId?: string | null;
    businessType?: string | null;
    source?: string | null;
    properties?: any;
  },
) {
  try {
    return await (prisma as any).trialLifecycleEvent.create({
      data: {
        eventType: input.eventType,
        eventAt: input.eventAt ?? new Date(),
        dedupeKey: input.dedupeKey ?? null,
        campaignId: input.campaignId ?? null,
        redemptionId: input.redemptionId ?? null,
        billingAccountId: input.billingAccountId ?? null,
        installationId: input.installationId ?? null,
        instanceId: input.instanceId ?? null,
        businessType: input.businessType ?? null,
        source: input.source ?? null,
        properties: input.properties ?? null,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002" && input.dedupeKey) {
      return null;
    }
    throw error;
  }
}

async function getTrialContextForBillingAccount(prisma: PrismaClient, billingAccountId: string) {
  const redemption = await (prisma as any).trialRedemption.findFirst({
    where: { billingAccountId },
    orderBy: { redeemedAt: "desc" },
  });
  const account = await (prisma as any).billingAccount.findUnique({
    where: { id: billingAccountId },
    include: { installation: true },
  });
  const lead =
    redemption?.id
      ? await (prisma as any).leadAttribution.findFirst({
          where: { redemptionId: redemption.id },
          orderBy: { createdAt: "desc" },
        })
      : null;
  const campaign =
    redemption?.campaignId
      ? await (prisma as any).trialCampaign.findUnique({
          where: { id: redemption.campaignId },
          select: { id: true, code: true, tier: true },
        })
      : null;
  return { redemption, account, lead, campaign };
}

export async function recordBillingPaymentLifecycleEvents(
  prisma: PrismaClient,
  input: {
    billingAccountId: string;
    invoiceId?: string | null;
    provider?: string | null;
    paidAt?: Date;
    source: string;
    raw?: any;
  },
) {
  const ctx = await getTrialContextForBillingAccount(prisma, input.billingAccountId);
  const paidAt = input.paidAt ?? new Date();
  const provider = (input.provider ?? "").toUpperCase();
  const base = {
    campaignId: ctx.redemption?.campaignId ?? null,
    redemptionId: ctx.redemption?.id ?? null,
    billingAccountId: input.billingAccountId,
    installationId: ctx.account?.installationId ?? null,
    instanceId: ctx.account?.instanceId ?? null,
    businessType: ctx.lead?.businessType ?? null,
    source: input.source,
  };

  if (provider === "MERCADOPAGO") {
    await recordTrialLifecycleEvent(prisma, {
      ...base,
      eventType: "PaymentMethodAdded",
      eventAt: paidAt,
      dedupeKey: `payment-method-added:${input.billingAccountId}:MERCADOPAGO`,
      properties: { invoiceId: input.invoiceId ?? null, provider, rawStatus: input.raw?.status ?? null },
    });
  }
  await recordTrialLifecycleEvent(prisma, {
    ...base,
    eventType: "ConvertedToPaid",
    eventAt: paidAt,
    dedupeKey: `converted-to-paid:${input.billingAccountId}`,
    properties: { invoiceId: input.invoiceId ?? null, provider },
  });
}

export async function syncDerivedTrialLifecycleEvents(prisma: PrismaClient, now = new Date()) {
  const [expiredTrials, overdueInvoices, restrictedAccounts] = await Promise.all([
    (prisma as any).billingAccount.findMany({
      where: { trialEndsAt: { lt: now } },
      select: { id: true, installationId: true, instanceId: true, trialEndsAt: true },
      take: 1000,
    }),
    (prisma as any).billingInvoice.findMany({
      where: { status: "OPEN", dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
      select: { id: true, accountId: true, dueAt: true, provider: true },
      take: 1000,
    }),
    (prisma as any).billingAccount.findMany({
      where: {
        OR: [{ status: "SUSPENDED" }, { hardLimitedAt: { not: null } }],
      },
      select: { id: true, installationId: true, instanceId: true, hardLimitedAt: true, updatedAt: true },
      take: 1000,
    }),
  ]);

  let created = 0;
  for (const account of expiredTrials) {
    const ctx = await getTrialContextForBillingAccount(prisma, account.id);
    const row = await recordTrialLifecycleEvent(prisma, {
      eventType: "TrialExpired",
      eventAt: account.trialEndsAt ?? now,
      dedupeKey: `trial-expired:${account.id}:${account.trialEndsAt?.toISOString() ?? "na"}`,
      campaignId: ctx.redemption?.campaignId ?? null,
      redemptionId: ctx.redemption?.id ?? null,
      billingAccountId: account.id,
      installationId: account.installationId ?? null,
      instanceId: account.instanceId ?? null,
      businessType: ctx.lead?.businessType ?? null,
      source: "derived-sync",
      properties: null,
    });
    if (row) created += 1;
  }
  for (const invoice of overdueInvoices) {
    const ctx = await getTrialContextForBillingAccount(prisma, invoice.accountId);
    const row = await recordTrialLifecycleEvent(prisma, {
      eventType: "BecamePastDue",
      eventAt: invoice.dueAt,
      dedupeKey: `past-due:${invoice.id}`,
      campaignId: ctx.redemption?.campaignId ?? null,
      redemptionId: ctx.redemption?.id ?? null,
      billingAccountId: invoice.accountId,
      installationId: ctx.account?.installationId ?? null,
      instanceId: ctx.account?.instanceId ?? null,
      businessType: ctx.lead?.businessType ?? null,
      source: "derived-sync",
      properties: { invoiceId: invoice.id, provider: invoice.provider },
    });
    if (row) created += 1;
  }
  for (const account of restrictedAccounts) {
    const ctx = await getTrialContextForBillingAccount(prisma, account.id);
    const eventAt = account.hardLimitedAt ?? account.updatedAt ?? now;
    const row = await recordTrialLifecycleEvent(prisma, {
      eventType: "BecameRestricted",
      eventAt,
      dedupeKey: `restricted:${account.id}:${eventAt.toISOString()}`,
      campaignId: ctx.redemption?.campaignId ?? null,
      redemptionId: ctx.redemption?.id ?? null,
      billingAccountId: account.id,
      installationId: account.installationId ?? null,
      instanceId: account.instanceId ?? null,
      businessType: ctx.lead?.businessType ?? null,
      source: "derived-sync",
      properties: null,
    });
    if (row) created += 1;
  }
  return {
    scanned: {
      expiredTrials: expiredTrials.length,
      overdueInvoices: overdueInvoices.length,
      restrictedAccounts: restrictedAccounts.length,
    },
    created,
  };
}

export async function loadTrialAnalyticsDashboard(
  prisma: PrismaClient,
  params: { from?: string | null; to?: string | null; syncDerived?: boolean },
) {
  const range = parseBaDateRange({ from: params.from, to: params.to });
  if (params.syncDerived !== false) {
    await syncDerivedTrialLifecycleEvents(prisma, new Date());
  }

  const toPlus30Utc = new Date(range.toUtc.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [campaigns, leads, events, activeTrials] = await Promise.all([
    (prisma as any).trialCampaign.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, tier: true, status: true, createdAt: true },
    }),
    (prisma as any).leadAttribution.findMany({
      where: { createdAt: { gte: range.fromUtc, lte: range.toUtc } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        campaignId: true,
        businessType: true,
        createdAt: true,
      },
    }),
    (prisma as any).trialLifecycleEvent.findMany({
      where: {
        OR: [
          { eventAt: { gte: range.fromUtc, lte: range.toUtc } },
          { eventType: "ConvertedToPaid", eventAt: { gte: range.fromUtc, lte: toPlus30Utc } },
        ],
      },
      orderBy: { eventAt: "asc" },
      select: {
        id: true,
        eventType: true,
        eventAt: true,
        campaignId: true,
        billingAccountId: true,
        instanceId: true,
        businessType: true,
      },
    }),
    (prisma as any).billingAccount.count({
      where: { trialEndsAt: { gt: new Date() }, status: { in: ["ACTIVE", "PAST_DUE"] } },
    }),
  ]);

  const campaignMap = new Map<string, any>(campaigns.map((c: any) => [c.id, c] as [string, any]));
  const aggregated = aggregateTrialFunnelAnalytics({
    leads: leads.map((lead: any) => {
      const campaign = lead.campaignId ? campaignMap.get(lead.campaignId) : null;
      return {
        createdAt: lead.createdAt,
        campaignId: lead.campaignId ?? null,
        campaignCode: campaign?.code ?? null,
        campaignTier: campaign?.tier ?? null,
        businessType: lead.businessType ?? null,
      } satisfies TrialAnalyticsLeadRow;
    }),
    events: events.map((event: any) => {
      const campaign = event.campaignId ? campaignMap.get(event.campaignId) : null;
      return {
        eventType: event.eventType as TrialLifecycleEventName,
        eventAt: event.eventAt,
        campaignId: event.campaignId ?? null,
        campaignCode: campaign?.code ?? null,
        campaignTier: campaign?.tier ?? null,
        billingAccountId: event.billingAccountId ?? null,
        instanceId: event.instanceId ?? null,
        businessType: event.businessType ?? null,
      } satisfies TrialAnalyticsEventRow;
    }),
  });

  const recentEvents = events
    .filter((e: any) => e.eventAt >= range.fromUtc && e.eventAt <= range.toUtc)
    .slice(-200)
    .reverse();

  return {
    range: {
      from: range.from,
      to: range.to,
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      invalid: range.invalid,
    },
    campaigns,
    ...aggregated,
    summary: {
      activeTrials,
      campaignsTotal: campaigns.length,
      eventsInRange: events.filter((e: any) => e.eventAt >= range.fromUtc && e.eventAt <= range.toUtc).length,
    },
    recentEvents,
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildTrialAnalyticsCsv(data: Awaited<ReturnType<typeof loadTrialAnalyticsDashboard>>) {
  const rows: string[] = [];
  rows.push(["section", "campaign_code", "campaign_tier", "signups", "trial_started", "payment_method_added", "converted_to_paid", "conversion_rate_pct", "became_past_due", "became_restricted"].map(csvCell).join(","));
  for (const row of data.funnel) {
    rows.push(
      [
        "funnel",
        row.campaignCode,
        row.campaignTier ?? "",
        row.signups,
        row.trialStarted,
        row.paymentMethodAdded,
        row.convertedToPaid,
        row.conversionRate,
        row.becamePastDue,
        row.becameRestricted,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  rows.push(["section", "cohort_date", "starts", "converted_7d", "converted_14d", "converted_30d", "rate_7d", "rate_14d", "rate_30d"].map(csvCell).join(","));
  for (const row of data.cohorts) {
    rows.push(["cohort", row.cohortDate, row.starts, row.converted7d, row.converted14d, row.converted30d, row.rate7d, row.rate14d, row.rate30d].map(csvCell).join(","));
  }
  rows.push(["section", "business_type", "signups", "trial_started", "converted_to_paid", "conversion_rate_pct"].map(csvCell).join(","));
  for (const row of data.icp) {
    rows.push(["icp", row.businessType, row.signups, row.trialStarted, row.convertedToPaid, row.conversionRate].map(csvCell).join(","));
  }
  return rows.join("\n");
}
