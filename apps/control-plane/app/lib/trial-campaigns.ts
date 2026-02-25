import crypto from "node:crypto";

export type TrialTier = "C1" | "C2";

export type TrialCampaignInput = {
  code: string;
  tier: TrialTier;
  durationDays: number;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
  requiresApproval?: boolean;
  allowedDomains?: string[] | null;
  blockedDomains?: string[] | null;
  status?: "ACTIVE" | "REVOKED";
};

export type AntiAbuseCheckInput = {
  now: Date;
  campaign: TrialCampaignInput;
  redeemedCount: number;
  emailDomain?: string | null;
  fingerprintHash?: string | null;
  existingByDomain: number;
  existingByFingerprint: number;
  recentAttemptsFromIp: number;
  maxAttemptsPerHour?: number;
  globalBlockedDomains?: string[];
  blockedFingerprints?: string[];
};

export type EligibilityDecision =
  | { ok: true; status: "PENDING_APPROVAL" | "REDEEMED"; reason?: undefined }
  | { ok: false; status: "REJECTED" | "BLOCKED" | "EXPIRED"; reason: string };

export function normalizeTrialCode(value: string) {
  return (value || "").trim().toUpperCase();
}

export function hashTrialSignal(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return null;
  const salt = process.env.TRIAL_CAMPAIGN_HASH_SALT ?? "trial-campaign-dev-salt";
  return crypto.createHash("sha256").update(`${salt}:${raw.toLowerCase()}`).digest("hex");
}

export function normalizeHostLike(value?: string | null) {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  return raw
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .trim() || null;
}

export function emailDomainFromAddress(value?: string | null) {
  const raw = (value || "").trim().toLowerCase();
  if (!raw.includes("@")) return null;
  return normalizeHostLike(raw.split("@")[1] ?? null);
}

export function parseList(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => normalizeHostLike(item))
    .filter((item): item is string => Boolean(item));
}

export function evaluateTrialCampaignEligibility(input: AntiAbuseCheckInput): EligibilityDecision {
  const maxAttempts = input.maxAttemptsPerHour ?? 5;
  const now = input.now;
  const campaign = input.campaign;
  if ((campaign.status ?? "ACTIVE") !== "ACTIVE") {
    return { ok: false, status: "BLOCKED", reason: "campaign_revoked" };
  }
  if (campaign.expiresAt && now >= campaign.expiresAt) {
    return { ok: false, status: "EXPIRED", reason: "campaign_expired" };
  }
  if (campaign.maxRedemptions != null && input.redeemedCount >= campaign.maxRedemptions) {
    return { ok: false, status: "REJECTED", reason: "max_redemptions_reached" };
  }

  const emailDomain = normalizeHostLike(input.emailDomain);
  const allowed = (campaign.allowedDomains ?? []).map((d) => normalizeHostLike(d)).filter(Boolean) as string[];
  const blocked = [
    ...((campaign.blockedDomains ?? []).map((d) => normalizeHostLike(d)).filter(Boolean) as string[]),
    ...((input.globalBlockedDomains ?? []).map((d) => normalizeHostLike(d)).filter(Boolean) as string[]),
  ];

  if (emailDomain && blocked.includes(emailDomain)) {
    return { ok: false, status: "BLOCKED", reason: "blocked_domain" };
  }
  if (emailDomain && allowed.length > 0 && !allowed.includes(emailDomain)) {
    return { ok: false, status: "REJECTED", reason: "domain_not_allowed" };
  }
  if (input.blockedFingerprints?.length && input.fingerprintHash && input.blockedFingerprints.includes(input.fingerprintHash)) {
    return { ok: false, status: "BLOCKED", reason: "blocked_fingerprint" };
  }
  if (emailDomain && input.existingByDomain > 0) {
    return { ok: false, status: "BLOCKED", reason: "domain_already_used_trial" };
  }
  if (input.fingerprintHash && input.existingByFingerprint > 0) {
    return { ok: false, status: "BLOCKED", reason: "fingerprint_already_used_trial" };
  }
  if (input.recentAttemptsFromIp >= maxAttempts) {
    return { ok: false, status: "BLOCKED", reason: "rate_limited_ip" };
  }

  return { ok: true, status: campaign.requiresApproval ? "PENDING_APPROVAL" : "REDEEMED" };
}

export function trialCampaignLink(baseUrl: string, code: string) {
  const url = new URL("/signup", baseUrl);
  url.searchParams.set("trial", normalizeTrialCode(code));
  return url.toString();
}

export function computeEarlyChurn(input: { redeemedAt: Date; cancelledAt?: Date | null; windowDays?: number }) {
  if (!input.cancelledAt) return false;
  const windowMs = (input.windowDays ?? 45) * 24 * 60 * 60 * 1000;
  return input.cancelledAt.getTime() - input.redeemedAt.getTime() <= windowMs;
}

