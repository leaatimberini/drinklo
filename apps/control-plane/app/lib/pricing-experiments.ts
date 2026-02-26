import crypto from "node:crypto";
import { hashEvidencePayload } from "./compliance-evidence";
import { signPayload } from "./signing";

export type ExperimentVariantConfig = {
  planTier?: string | null;
  badge?: string | null;
  offer?: {
    kind?: "PERCENT_OFF";
    percentOff: number;
    billingCycles?: number | null;
    expiresDays?: number | null;
    label?: string | null;
  } | null;
};

export function normalizePricingExperimentKey(input: unknown) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hashStable(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function normalizeDomain(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0]?.trim() || null;
}

export function buildPricingExperimentStickySeed(input: {
  cookieId?: string | null;
  emailDomain?: string | null;
  trialCode?: string | null;
  experimentKey: string;
}) {
  const cookie = String(input.cookieId ?? "").trim();
  const domain = normalizeDomain(input.emailDomain);
  const trial = String(input.trialCode ?? "").trim().toUpperCase();
  if (!cookie && !domain) return null;
  return `exp:${normalizePricingExperimentKey(input.experimentKey)}|trial:${trial || "na"}|cookie:${cookie || "na"}|domain:${domain || "na"}`;
}

export function deterministicBucket(seed: string, mod = 10000) {
  const hex = hashStable(seed).slice(0, 12);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n % mod : 0;
}

export function pickWeightedVariant<T extends { key: string; weight: number }>(variants: T[], seed: string): T {
  const list = variants
    .map((v) => ({ ...v, weight: Math.max(0, Number(v.weight ?? 0)) }))
    .filter((v) => v.weight > 0);
  if (list.length === 0) throw new Error("no_variants");
  const total = list.reduce((acc, v) => acc + v.weight, 0);
  const bucket = deterministicBucket(seed, total);
  let acc = 0;
  for (const variant of list) {
    acc += variant.weight;
    if (bucket < acc) return variant as T;
  }
  return list[list.length - 1] as T;
}

export function parseVariantConfig(value: unknown): ExperimentVariantConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as any;
  const percentOff = Number(raw?.offer?.percentOff);
  const offer = raw.offer
    ? {
        kind: "PERCENT_OFF" as const,
        percentOff: Number.isFinite(percentOff) ? Math.max(0, Math.min(100, percentOff)) : 0,
        billingCycles: raw.offer.billingCycles == null ? null : Math.max(1, Number(raw.offer.billingCycles)),
        expiresDays: raw.offer.expiresDays == null ? null : Math.max(1, Number(raw.offer.expiresDays)),
        label: raw.offer.label ? String(raw.offer.label) : null,
      }
    : null;
  return {
    planTier: raw.planTier ? String(raw.planTier).toUpperCase() : null,
    badge: raw.badge ? String(raw.badge) : null,
    offer: offer && offer.percentOff > 0 ? offer : null,
  };
}

export function isExperimentActiveAt(experiment: any, at = new Date()) {
  const status = String(experiment.status ?? "DRAFT").toUpperCase();
  if (status !== "ACTIVE") return false;
  if (experiment.startAt && new Date(experiment.startAt).getTime() > at.getTime()) return false;
  if (experiment.endAt && new Date(experiment.endAt).getTime() <= at.getTime()) return false;
  return true;
}

function matchesFilters(experiment: any, ctx: { targetTier?: string | null; trialCode?: string | null; icp?: string | null }) {
  const tier = String(ctx.targetTier ?? "").toUpperCase();
  if (tier && String(experiment.targetTier ?? "").toUpperCase() !== tier) return false;
  const trialCode = String(ctx.trialCode ?? "").trim().toUpperCase();
  const codes = Array.isArray(experiment.trialCampaignCodes) ? experiment.trialCampaignCodes.map((v: any) => String(v).toUpperCase()) : [];
  if (codes.length > 0 && (!trialCode || !codes.includes(trialCode))) return false;
  const icp = String(ctx.icp ?? "").trim().toLowerCase();
  const icpFilters = Array.isArray(experiment.icpFilters) ? experiment.icpFilters.map((v: any) => String(v).toLowerCase()) : [];
  if (icpFilters.length > 0 && (!icp || !icpFilters.includes(icp))) return false;
  return true;
}

function pricingExperimentSigningSecret() {
  return (
    process.env.CONTROL_PLANE_PRICING_EXPERIMENTS_SECRET ??
    process.env.SOC2_EVIDENCE_SIGNING_SECRET ??
    process.env.CONTROL_PLANE_ADMIN_TOKEN ??
    "pricing-experiments-dev"
  );
}

async function recordEvidence(prisma: any, input: {
  installationId?: string | null;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  tags?: string[];
}) {
  const evidenceSignature = signPayload(input.payload, pricingExperimentSigningSecret());
  const payload = { ...input.payload, evidenceSignature };
  return prisma.complianceEvidence.create({
    data: {
      installationId: input.installationId ?? null,
      evidenceType: input.type,
      source: "pricing_experiments",
      payload,
      payloadHash: hashEvidencePayload(payload),
      sourceCapturedAt: new Date(),
      capturedBy: input.actor,
      tags: input.tags ?? ["billing", "pricing-experiments"],
    },
  });
}

export function buildOfferGrantFromVariant(variantConfig: ExperimentVariantConfig, assignedAt: Date) {
  const offer = variantConfig.offer;
  if (!offer || offer.percentOff <= 0) return null;
  const offerExpiresAt = offer.expiresDays ? new Date(assignedAt.getTime() + offer.expiresDays * 24 * 60 * 60 * 1000) : null;
  return {
    offerStatus: "GRANTED",
    offerGrantedAt: assignedAt,
    offerExpiresAt,
    offerConsumedCycles: 0,
    offerMaxCycles: offer.billingCycles ?? null,
    offerMeta: {
      kind: "PERCENT_OFF",
      percentOff: offer.percentOff,
      billingCycles: offer.billingCycles ?? null,
      expiresDays: offer.expiresDays ?? null,
      label: offer.label ?? null,
    },
  };
}

export function isOfferExpired(assignment: any, at = new Date()) {
  if (!assignment?.offerExpiresAt) return false;
  return new Date(assignment.offerExpiresAt).getTime() <= at.getTime();
}

export function canApplyOffer(assignment: any, at = new Date()) {
  if (!assignment) return { ok: false, reason: "assignment_missing" } as const;
  if (String(assignment.offerStatus ?? "ASSIGNED").toUpperCase() !== "GRANTED") return { ok: false, reason: "offer_not_granted" } as const;
  if (isOfferExpired(assignment, at)) return { ok: false, reason: "offer_expired" } as const;
  const consumed = Number(assignment.offerConsumedCycles ?? 0);
  const maxCycles = assignment.offerMaxCycles == null ? null : Number(assignment.offerMaxCycles);
  if (maxCycles != null && consumed >= maxCycles) return { ok: false, reason: "offer_cycles_exhausted" } as const;
  const offer = parseVariantConfig({ offer: assignment.offerMeta }).offer;
  if (!offer || offer.percentOff <= 0) return { ok: false, reason: "offer_invalid" } as const;
  return { ok: true, offer } as const;
}

export function applyPercentOffOffer(input: { baseAmount: number; percentOff: number }) {
  const base = Number(input.baseAmount);
  const pct = Math.max(0, Math.min(100, Number(input.percentOff)));
  const discount = Number(((base * pct) / 100).toFixed(2));
  const total = Number(Math.max(0, base - discount).toFixed(2));
  return { baseAmount: Number(base.toFixed(2)), discountAmount: discount, finalAmount: total, percentOff: pct };
}

export async function assignPricingExperimentsForContext(
  prisma: any,
  ctx: {
    instanceId?: string | null;
    installationId?: string | null;
    billingAccountId?: string | null;
    leadAttributionId?: string | null;
    trialRedemptionId?: string | null;
    cookieId?: string | null;
    emailDomain?: string | null;
    targetTier?: string | null;
    trialCode?: string | null;
    icp?: string | null;
    source: string;
    actor?: string | null;
    now?: Date;
  },
) {
  const now = ctx.now ?? new Date();
  const targetTier = String(ctx.targetTier ?? "").toUpperCase();
  if (!targetTier) return { assignments: [] as any[], cookieId: ctx.cookieId ?? null };

  const experiments = await prisma.pricingExperiment.findMany({
    where: { status: "ACTIVE", targetTier },
    include: { variants: true },
    orderBy: [{ createdAt: "asc" }],
  });

  const active = experiments.filter((exp: any) => isExperimentActiveAt(exp, now) && matchesFilters(exp, ctx));
  const assignments: any[] = [];
  const actor = ctx.actor ?? "system:pricing-experiments";

  for (const exp of active) {
    const seed = buildPricingExperimentStickySeed({
      cookieId: ctx.cookieId,
      emailDomain: ctx.emailDomain,
      trialCode: ctx.trialCode,
      experimentKey: exp.key,
    });
    if (!seed) continue;
    const stickyKeyHash = hashStable(seed);
    const cookieIdHash = ctx.cookieId ? hashStable(`cookie:${ctx.cookieId}`) : null;

    let assignment = await prisma.pricingExperimentAssignment.findUnique({
      where: { experimentId_stickyKeyHash: { experimentId: exp.id, stickyKeyHash } },
      include: { variant: true, experiment: true },
    }).catch(() => null);

    if (!assignment) {
      const variant = pickWeightedVariant(exp.variants as any[], `${seed}|${exp.id}`);
      const variantConfig = parseVariantConfig((variant as any).config);
      const grant = ctx.billingAccountId ? buildOfferGrantFromVariant(variantConfig, now) : null;
      assignment = await prisma.pricingExperimentAssignment.create({
        data: {
          experimentId: exp.id,
          variantId: (variant as any).id,
          installationId: ctx.installationId ?? null,
          billingAccountId: ctx.billingAccountId ?? null,
          leadAttributionId: ctx.leadAttributionId ?? null,
          trialRedemptionId: ctx.trialRedemptionId ?? null,
          instanceId: ctx.instanceId ?? null,
          stickyKeyHash,
          cookieIdHash,
          emailDomain: ctx.emailDomain ? normalizeDomain(ctx.emailDomain) : null,
          source: ctx.source,
          ...(grant ?? {}),
        },
        include: { variant: true, experiment: true },
      });
      await recordEvidence(prisma, {
        installationId: ctx.installationId ?? null,
        type: "pricing_experiment.assignment",
        actor,
        payload: {
          experimentId: exp.id,
          experimentKey: exp.key,
          variantId: (variant as any).id,
          variantKey: (variant as any).key,
          instanceId: ctx.instanceId ?? null,
          billingAccountId: ctx.billingAccountId ?? null,
          leadAttributionId: ctx.leadAttributionId ?? null,
          trialRedemptionId: ctx.trialRedemptionId ?? null,
          stickyKeyHash,
          source: ctx.source,
          offerGranted: Boolean(grant),
          offerExpiresAt: grant?.offerExpiresAt?.toISOString() ?? null,
        },
        tags: ["billing", "pricing-experiments", "assignment"],
      }).catch(() => undefined);
    } else {
      const updates: any = {};
      if (!assignment.installationId && ctx.installationId) updates.installationId = ctx.installationId;
      if (!assignment.billingAccountId && ctx.billingAccountId) updates.billingAccountId = ctx.billingAccountId;
      if (!assignment.leadAttributionId && ctx.leadAttributionId) updates.leadAttributionId = ctx.leadAttributionId;
      if (!assignment.trialRedemptionId && ctx.trialRedemptionId) updates.trialRedemptionId = ctx.trialRedemptionId;
      if (!assignment.instanceId && ctx.instanceId) updates.instanceId = ctx.instanceId;
      if (!assignment.emailDomain && ctx.emailDomain) updates.emailDomain = normalizeDomain(ctx.emailDomain);
      if (!assignment.cookieIdHash && cookieIdHash) updates.cookieIdHash = cookieIdHash;

      const hasAccount = Boolean(ctx.billingAccountId);
      const alreadyGranted = String(assignment.offerStatus ?? "").toUpperCase() === "GRANTED" || Boolean(assignment.offerGrantedAt);
      if (hasAccount && !alreadyGranted) {
        const variantConfig = parseVariantConfig(assignment.variant?.config);
        const grant = buildOfferGrantFromVariant(variantConfig, now);
        if (grant) Object.assign(updates, grant);
      }

      if (Object.keys(updates).length > 0) {
        assignment = await prisma.pricingExperimentAssignment.update({
          where: { id: assignment.id },
          data: updates,
          include: { variant: true, experiment: true },
        });
        if (updates.offerGrantedAt) {
          await recordEvidence(prisma, {
            installationId: assignment.installationId ?? null,
            type: "pricing_experiment.offer_grant",
            actor,
            payload: {
              experimentId: assignment.experimentId,
              variantId: assignment.variantId,
              assignmentId: assignment.id,
              billingAccountId: assignment.billingAccountId,
              offerExpiresAt: assignment.offerExpiresAt?.toISOString() ?? null,
              offerMeta: assignment.offerMeta ?? null,
            },
            tags: ["billing", "pricing-experiments", "offer"],
          }).catch(() => undefined);
        }
      }
    }

    assignments.push(assignment);
  }

  return { assignments, cookieId: ctx.cookieId ?? null };
}

export async function applyPricingExperimentOfferToInvoice(
  prisma: any,
  input: {
    billingAccountId: string;
    invoiceId: string;
    amount: number;
    currency: string;
    actor: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const assignments = await prisma.pricingExperimentAssignment.findMany({
    where: {
      billingAccountId: input.billingAccountId,
      offerStatus: { in: ["GRANTED", "ASSIGNED"] },
    },
    include: { experiment: true, variant: true },
    orderBy: [{ assignedAt: "asc" }],
    take: 20,
  });

  for (const assignment of assignments as any[]) {
    if (!isExperimentActiveAt(assignment.experiment, now)) continue;
    if (String(assignment.offerStatus ?? "ASSIGNED").toUpperCase() === "ASSIGNED") continue;
    const can = canApplyOffer(assignment, now);
    if (!can.ok) {
      if (can.reason === "offer_expired") {
        await prisma.pricingExperimentAssignment.update({ where: { id: assignment.id }, data: { offerStatus: "EXPIRED" } }).catch(() => undefined);
      }
      continue;
    }
    const applied = applyPercentOffOffer({ baseAmount: input.amount, percentOff: can.offer.percentOff });
    const nextConsumed = Number(assignment.offerConsumedCycles ?? 0) + 1;
    const exhausted = assignment.offerMaxCycles != null && nextConsumed >= Number(assignment.offerMaxCycles);
    await prisma.pricingExperimentAssignment.update({
      where: { id: assignment.id },
      data: {
        offerConsumedCycles: nextConsumed,
        lastInvoiceId: input.invoiceId,
        lastAppliedAt: now,
        offerStatus: exhausted ? "CONSUMED" : "GRANTED",
      },
    });
    await recordEvidence(prisma, {
      installationId: assignment.installationId ?? null,
      type: "pricing_experiment.offer_applied",
      actor: input.actor,
      payload: {
        assignmentId: assignment.id,
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
        billingAccountId: input.billingAccountId,
        invoiceId: input.invoiceId,
        currency: input.currency,
        baseAmount: applied.baseAmount,
        discountAmount: applied.discountAmount,
        finalAmount: applied.finalAmount,
        percentOff: applied.percentOff,
        consumedCycles: nextConsumed,
        maxCycles: assignment.offerMaxCycles ?? null,
        exhausted,
      },
      tags: ["billing", "pricing-experiments", "offer-applied"],
    }).catch(() => undefined);
    return {
      applied: true,
      assignmentId: assignment.id,
      experimentId: assignment.experimentId,
      variantId: assignment.variantId,
      variantKey: assignment.variant?.key ?? null,
      ...applied,
      remainingCycles:
        assignment.offerMaxCycles == null ? null : Math.max(0, Number(assignment.offerMaxCycles) - nextConsumed),
      offerStatusAfter: exhausted ? "CONSUMED" : "GRANTED",
    };
  }

  return {
    applied: false,
    baseAmount: Number(input.amount.toFixed(2)),
    discountAmount: 0,
    finalAmount: Number(input.amount.toFixed(2)),
    percentOff: 0,
    reason: "no_active_offer",
  };
}

export async function getPricingExperimentResults(prisma: any, args?: { from?: Date | null; to?: Date | null }) {
  const from = args?.from ?? null;
  const to = args?.to ?? null;
  const whereAssigned: any = {};
  if (from || to) whereAssigned.assignedAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const [experiments, assignments, trialEvents, invoices, accounts] = await Promise.all([
    prisma.pricingExperiment.findMany({ include: { variants: true }, orderBy: [{ createdAt: "desc" }], take: 200 }),
    prisma.pricingExperimentAssignment.findMany({
      where: whereAssigned,
      include: { experiment: true, variant: true },
      orderBy: [{ assignedAt: "desc" }],
      take: 5000,
    }),
    prisma.trialLifecycleEvent.findMany({
      where: {
        ...(from || to ? { eventAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        eventType: { in: ["ConvertedToPaid", "BecameRestricted", "BecamePastDue"] },
      },
      select: { billingAccountId: true, eventType: true, eventAt: true },
      take: 10000,
      orderBy: [{ eventAt: "desc" }],
    }),
    prisma.billingInvoice.findMany({
      where: {
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        status: "PAID",
      },
      select: { id: true, accountId: true, amount: true, currency: true, createdAt: true, paidAt: true },
      take: 20000,
    }),
    prisma.billingAccount.findMany({ select: { id: true, status: true, createdAt: true, updatedAt: true } }),
  ]);

  const eventsByAccount = new Map<string, any[]>();
  for (const evt of trialEvents as any[]) {
    if (!evt.billingAccountId) continue;
    const list = eventsByAccount.get(evt.billingAccountId) ?? [];
    list.push(evt);
    eventsByAccount.set(evt.billingAccountId, list);
  }
  const paidInvoicesByAccount = new Map<string, any[]>();
  for (const inv of invoices as any[]) {
    const list = paidInvoicesByAccount.get(inv.accountId) ?? [];
    list.push(inv);
    paidInvoicesByAccount.set(inv.accountId, list);
  }
  const accountMap = new Map((accounts as any[]).map((a: any) => [a.id, a]));

  const rowsByVariant = new Map<string, any>();
  for (const a of assignments as any[]) {
    const key = `${a.experimentId}:${a.variantId}`;
    const row = rowsByVariant.get(key) ?? {
      experimentId: a.experimentId,
      experimentKey: a.experiment?.key ?? null,
      experimentName: a.experiment?.name ?? null,
      variantId: a.variantId,
      variantKey: a.variant?.key ?? null,
      variantName: a.variant?.name ?? null,
      assigned: 0,
      grantedOffers: 0,
      converted: 0,
      pastDue: 0,
      restricted: 0,
      earlyChurn: 0,
      paidRevenue: 0,
      paidInvoices: 0,
      uniqueAccounts: new Set<string>(),
      convertedAccounts: new Set<string>(),
    };
    row.assigned += 1;
    if (a.offerGrantedAt) row.grantedOffers += 1;
    if (a.billingAccountId) {
      row.uniqueAccounts.add(a.billingAccountId);
      const evts = eventsByAccount.get(a.billingAccountId) ?? [];
      if (evts.some((e: any) => e.eventType === "ConvertedToPaid")) {
        row.convertedAccounts.add(a.billingAccountId);
      }
      if (evts.some((e: any) => e.eventType === "BecamePastDue")) row.pastDue += 1;
      if (evts.some((e: any) => e.eventType === "BecameRestricted")) row.restricted += 1;
      const paid = paidInvoicesByAccount.get(a.billingAccountId) ?? [];
      row.paidInvoices += paid.length;
      row.paidRevenue += paid.reduce((sum: number, inv: any) => sum + Number(inv.amount ?? 0), 0);

      const account = accountMap.get(a.billingAccountId);
      const status = String(account?.status ?? "").toUpperCase();
      if (["SUSPENDED", "CANCELED"].includes(status)) {
        const createdAt = new Date(account.createdAt).getTime();
        const updatedAt = new Date(account.updatedAt).getTime();
        if (updatedAt - createdAt <= 30 * 24 * 60 * 60 * 1000) {
          row.earlyChurn += 1;
        }
      }
    }
    rowsByVariant.set(key, row);
  }

  const variantResults = Array.from(rowsByVariant.values())
    .map((row: any) => ({
      experimentId: row.experimentId,
      experimentKey: row.experimentKey,
      experimentName: row.experimentName,
      variantId: row.variantId,
      variantKey: row.variantKey,
      variantName: row.variantName,
      assigned: row.assigned,
      grantedOffers: row.grantedOffers,
      accounts: row.uniqueAccounts.size,
      converted: row.convertedAccounts.size,
      conversionRate: row.uniqueAccounts.size > 0 ? Number(((row.convertedAccounts.size / row.uniqueAccounts.size) * 100).toFixed(2)) : 0,
      arpa: row.paidInvoices > 0 ? Number((row.paidRevenue / row.paidInvoices).toFixed(2)) : 0,
      paidRevenue: Number(row.paidRevenue.toFixed(2)),
      paidInvoices: row.paidInvoices,
      pastDue: row.pastDue,
      restricted: row.restricted,
      earlyChurn: row.earlyChurn,
      earlyChurnRate: row.uniqueAccounts.size > 0 ? Number(((row.earlyChurn / row.uniqueAccounts.size) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.experimentKey.localeCompare(b.experimentKey) || a.variantKey.localeCompare(b.variantKey));

  const experimentsSummary = (experiments as any[]).map((exp: any) => ({
    id: exp.id,
    key: exp.key,
    name: exp.name,
    status: exp.status,
    targetTier: exp.targetTier,
    variants: (exp.variants ?? []).map((v: any) => ({ id: v.id, key: v.key, name: v.name, weight: v.weight, isControl: v.isControl, config: v.config })),
    results: variantResults.filter((r) => r.experimentId === exp.id),
  }));

  return {
    experiments: experimentsSummary,
    variants: variantResults,
    totals: {
      experiments: experimentsSummary.length,
      assignments: (assignments as any[]).length,
      converted: variantResults.reduce((acc, r) => acc + r.converted, 0),
      paidRevenue: Number(variantResults.reduce((acc, r) => acc + r.paidRevenue, 0).toFixed(2)),
    },
  };
}

export async function upsertPricingExperiment(prisma: any, input: any, actor = "cp:admin") {
  const key = normalizePricingExperimentKey(input.key);
  if (!key) throw new Error("experiment_key_required");
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("experiment_name_required");
  const targetTier = String(input.targetTier ?? "").trim().toUpperCase();
  if (!["C1", "C2", "C3"].includes(targetTier)) throw new Error("invalid_target_tier");
  const status = String(input.status ?? "DRAFT").trim().toUpperCase();
  if (!["DRAFT", "ACTIVE", "PAUSED", "ENDED"].includes(status)) throw new Error("invalid_status");
  const billingPeriod = String(input.billingPeriod ?? "MONTHLY").trim().toUpperCase();
  if (!["MONTHLY", "YEARLY"].includes(billingPeriod)) throw new Error("invalid_billing_period");
  const currencies = Array.from(new Set((Array.isArray(input.currencies) ? input.currencies : [input.currencies ?? "USD"]).map((v: any) => String(v).trim().toUpperCase()).filter(Boolean)));
  const trialCampaignCodes = Array.from(new Set((input.trialCampaignCodes ?? []).map((v: any) => String(v).trim().toUpperCase()).filter(Boolean)));
  const icpFilters = Array.from(new Set((input.icpFilters ?? []).map((v: any) => String(v).trim().toLowerCase()).filter(Boolean)));
  const startAt = input.startAt ? new Date(String(input.startAt)) : null;
  const endAt = input.endAt ? new Date(String(input.endAt)) : null;
  if (startAt && Number.isNaN(startAt.getTime())) throw new Error("invalid_startAt");
  if (endAt && Number.isNaN(endAt.getTime())) throw new Error("invalid_endAt");
  if (startAt && endAt && endAt <= startAt) throw new Error("endAt_must_be_gt_startAt");

  const variantsIn = Array.isArray(input.variants) ? input.variants : [];
  if (variantsIn.length < 2) throw new Error("at_least_two_variants_required");
  const variants = variantsIn.map((v: any, idx: number) => {
    const vKey = normalizePricingExperimentKey(v.key || `variant-${idx + 1}`);
    if (!vKey) throw new Error("variant_key_required");
    const vName = String(v.name ?? vKey).trim();
    const weight = Math.max(1, Math.floor(Number(v.weight ?? 100)));
    const config = v.config && typeof v.config === "object" ? v.config : {};
    parseVariantConfig(config);
    return { key: vKey, name: vName, weight, isControl: Boolean(v.isControl), config };
  });

  const existing = input.id ? await prisma.pricingExperiment.findUnique({ where: { id: String(input.id) } }) : await prisma.pricingExperiment.findUnique({ where: { key } });
  const experiment = existing
    ? await prisma.pricingExperiment.update({
        where: { id: existing.id },
        data: {
          key,
          name,
          status: status as any,
          targetTier,
          billingPeriod: billingPeriod as any,
          currencies,
          trialCampaignCodes,
          icpFilters,
          startAt,
          endAt,
          description: input.description ? String(input.description) : null,
          notes: input.notes ? String(input.notes) : null,
          updatedBy: actor,
        },
      })
    : await prisma.pricingExperiment.create({
        data: {
          key,
          name,
          status: status as any,
          targetTier,
          billingPeriod: billingPeriod as any,
          currencies,
          trialCampaignCodes,
          icpFilters,
          startAt,
          endAt,
          description: input.description ? String(input.description) : null,
          notes: input.notes ? String(input.notes) : null,
          createdBy: actor,
          updatedBy: actor,
        },
      });

  await prisma.$transaction(async (tx: any) => {
    await tx.pricingExperimentVariant.deleteMany({ where: { experimentId: experiment.id } });
    await tx.pricingExperimentVariant.createMany({
      data: variants.map((v: any) => ({
        experimentId: experiment.id,
        key: v.key,
        name: v.name,
        weight: v.weight,
        isControl: v.isControl,
        config: v.config,
      })),
    });
  });

  const full = await prisma.pricingExperiment.findUnique({ where: { id: experiment.id }, include: { variants: true } });
  await recordEvidence(prisma, {
    type: "pricing_experiment.upsert",
    actor,
    payload: {
      experimentId: experiment.id,
      key,
      name,
      status,
      targetTier,
      billingPeriod,
      variants: variants.map((v: any) => ({ key: v.key, weight: v.weight, isControl: v.isControl, config: v.config })),
    },
    tags: ["billing", "pricing-experiments", "config"],
  }).catch(() => undefined);
  return full;
}
