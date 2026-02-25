export type MarketingBusinessType = "kiosco" | "distribuidora" | "bar";

export function buildTrialSignupHref(trialCode?: string | null, basePath = "/signup") {
  const url = new URL(basePath, "https://marketing.local");
  const normalized = String(trialCode ?? "")
    .trim()
    .toUpperCase();
  if (normalized) {
    url.searchParams.set("trial", normalized);
  }
  return `${url.pathname}${url.search}`;
}

export function extractUtmFromSearchParams(params: URLSearchParams) {
  return {
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
    utmTerm: params.get("utm_term") ?? "",
    utmContent: params.get("utm_content") ?? "",
    referral: params.get("ref") ?? "",
  };
}

export function normalizeBusinessType(value: unknown): MarketingBusinessType {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "distribuidora") return "distribuidora";
  if (raw === "bar") return "bar";
  return "kiosco";
}

export function buildLeadPayload(input: {
  email: string;
  businessType: string;
  city: string;
  trial?: string | null;
  companyName?: string;
  domain?: string;
  consentMarketing?: boolean;
  utm?: Partial<{
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    referral: string;
  }>;
}) {
  const payload = {
    email: String(input.email ?? "").trim().toLowerCase(),
    businessType: normalizeBusinessType(input.businessType),
    city: String(input.city ?? "").trim(),
    trial: input.trial ? String(input.trial).trim().toUpperCase() : undefined,
    companyName: input.companyName ? String(input.companyName).trim() : undefined,
    domain: input.domain ? String(input.domain).trim() : undefined,
    consentMarketing: Boolean(input.consentMarketing),
    utmSource: input.utm?.utmSource?.trim() || undefined,
    utmMedium: input.utm?.utmMedium?.trim() || undefined,
    utmCampaign: input.utm?.utmCampaign?.trim() || undefined,
    utmTerm: input.utm?.utmTerm?.trim() || undefined,
    utmContent: input.utm?.utmContent?.trim() || undefined,
    referral: input.utm?.referral?.trim() || undefined,
  };
  return payload;
}

export function buildControlPlaneUrl(path: string) {
  const base = (process.env.CONTROL_PLANE_URL ?? process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

