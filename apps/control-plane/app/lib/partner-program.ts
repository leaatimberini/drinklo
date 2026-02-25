import crypto from "node:crypto";
import type { PrismaClient } from "./generated/prisma";

export type AttributionCookie = {
  leadId?: string;
  partnerSlug?: string;
  referralCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  clickedAt?: string;
};

export type UtmParams = Partial<{
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}>;

export type ResolvedAttribution = AttributionCookie & {
  hasAttribution: boolean;
  source: "cookie+utm" | "utm" | "cookie" | "none";
};

export type FraudDecision = {
  score: number;
  flags: string[];
  reason?: string;
};

export type CommissionLikePlan = {
  type: "PERCENT_REVENUE" | "FLAT_PER_CONVERSION" | "HYBRID" | string;
  percentRate?: number | null;
  flatAmount?: number | null;
  recurringInvoiceCap?: number | null;
};

export function generatePortalToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashPartnerToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function parseAttributionCookie(raw: string | null | undefined): AttributionCookie | null {
  return safeJsonParse<AttributionCookie>(raw);
}

export function buildAttributionCookie(input: AttributionCookie) {
  return JSON.stringify({
    ...input,
    clickedAt: input.clickedAt ?? new Date().toISOString(),
  });
}

function takeString(value: unknown) {
  const s = typeof value === "string" ? value.trim() : "";
  return s || undefined;
}

export function normalizeDomain(value?: string | null) {
  const raw = takeString(value);
  if (!raw) return undefined;
  const host = raw
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
  return host || undefined;
}

export function emailDomain(value?: string | null) {
  const email = takeString(value)?.toLowerCase();
  if (!email || !email.includes("@")) return undefined;
  return normalizeDomain(email.split("@")[1]);
}

export function resolveAttributionForAccountCreation(input: {
  cookie?: AttributionCookie | null;
  utm?: UtmParams | null;
  referralCode?: string | null;
}) {
  const cookie = input.cookie ?? null;
  const utm = input.utm ?? {};
  const merged: ResolvedAttribution = {
    leadId: takeString(cookie?.leadId),
    partnerSlug: takeString(cookie?.partnerSlug),
    referralCode: takeString(input.referralCode) ?? takeString(cookie?.referralCode),
    utmSource: takeString(utm.utmSource) ?? takeString(cookie?.utmSource),
    utmMedium: takeString(utm.utmMedium) ?? takeString(cookie?.utmMedium),
    utmCampaign: takeString(utm.utmCampaign) ?? takeString(cookie?.utmCampaign),
    utmTerm: takeString(utm.utmTerm) ?? takeString(cookie?.utmTerm),
    utmContent: takeString(utm.utmContent) ?? takeString(cookie?.utmContent),
    clickedAt: takeString(cookie?.clickedAt),
    hasAttribution: false,
    source: "none",
  };
  const hasCookie = Boolean(cookie && (merged.leadId || merged.partnerSlug || merged.referralCode));
  const hasUtm = Boolean(merged.utmSource || merged.utmMedium || merged.utmCampaign || merged.referralCode);
  merged.hasAttribution = hasCookie || hasUtm;
  merged.source = hasCookie && hasUtm ? "cookie+utm" : hasUtm ? "utm" : hasCookie ? "cookie" : "none";
  return merged;
}

export function detectBasicLeadFraud(input: {
  partnerWebsiteDomain?: string | null;
  clickIp?: string | null;
  accountIp?: string | null;
  accountEmail?: string | null;
  installationDomain?: string | null;
}) {
  const flags: string[] = [];
  const partnerDomain = normalizeDomain(input.partnerWebsiteDomain);
  const accEmailDomain = emailDomain(input.accountEmail);
  const installDomain = normalizeDomain(input.installationDomain);
  const clickIp = takeString(input.clickIp);
  const accountIp = takeString(input.accountIp);

  if (partnerDomain && accEmailDomain && partnerDomain === accEmailDomain) {
    flags.push("same_domain_email");
  }
  if (partnerDomain && installDomain && partnerDomain === installDomain) {
    flags.push("same_domain_site");
  }
  if (clickIp && accountIp && clickIp === accountIp) {
    flags.push("same_ip");
  }

  const score = flags.length * 40;
  return {
    score,
    flags,
    reason: flags[0],
  } satisfies FraudDecision;
}

export function calculateCommissionIncrement(input: {
  plan: CommissionLikePlan;
  invoiceAmount: number;
  invoiceIndex: number;
}) {
  const amount = Math.max(0, Number(input.invoiceAmount || 0));
  const cap = input.plan.recurringInvoiceCap ?? null;
  if (cap != null && input.invoiceIndex > cap) return 0;
  const pct = Math.max(0, Number(input.plan.percentRate ?? 0));
  const flat = Math.max(0, Number(input.plan.flatAmount ?? 0));
  if (input.plan.type === "FLAT_PER_CONVERSION") {
    return input.invoiceIndex === 1 ? flat : 0;
  }
  if (input.plan.type === "HYBRID") {
    return (input.invoiceIndex === 1 ? flat : 0) + amount * (pct / 100);
  }
  return amount * (pct / 100);
}

export function getRequestIp(req: { headers: { get(name: string): string | null } }) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

export function parseBaDateRange(input: { from?: string | null; to?: string | null }) {
  const today = new Date();
  const todayYmd = today.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const from = (input.from ?? "").trim() || todayYmd;
  const to = (input.to ?? "").trim() || todayYmd;
  const fromUtc = new Date(`${from}T00:00:00-03:00`);
  const toUtc = new Date(`${to}T23:59:59.999-03:00`);
  if (Number.isNaN(fromUtc.getTime()) || Number.isNaN(toUtc.getTime()) || fromUtc > toUtc) {
    const fallbackFrom = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      from: fallbackFrom.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }),
      to: todayYmd,
      fromUtc: new Date(`${fallbackFrom.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })}T00:00:00-03:00`),
      toUtc: new Date(`${todayYmd}T23:59:59.999-03:00`),
      invalid: true,
    };
  }
  return { from, to, fromUtc, toUtc, invalid: false };
}

export async function applyCommissionForInvoice(params: {
  prisma: PrismaClient;
  billingAccountId: string;
  invoiceAmount: number;
  currency: string;
}) {
  const conversion = await params.prisma.conversion.findFirst({
    where: {
      billingAccountId: params.billingAccountId,
      status: { in: ["ATTRIBUTED", "APPROVED", "REVIEW"] },
    },
    include: {
      commissionPlan: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!conversion || !conversion.commissionPlan) {
    return null;
  }

  const invoiceIndex = (conversion.invoiceCountApplied ?? 0) + 1;
  const increment = calculateCommissionIncrement({
    plan: conversion.commissionPlan,
    invoiceAmount: params.invoiceAmount,
    invoiceIndex,
  });

  const updated = await params.prisma.conversion.update({
    where: { id: conversion.id },
    data: {
      estimatedRevenueAmount: (conversion.estimatedRevenueAmount ?? 0) + Math.max(0, params.invoiceAmount),
      estimatedCommissionAmount: (conversion.estimatedCommissionAmount ?? 0) + increment,
      commissionCurrency: params.currency || conversion.commissionCurrency,
      invoiceCountApplied: invoiceIndex,
    },
  });
  return { conversionId: updated.id, increment, invoiceIndex };
}
