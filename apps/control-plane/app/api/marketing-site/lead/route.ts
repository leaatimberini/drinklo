import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "../../../lib/prisma";
import { hashTrialSignal, normalizeHostLike, normalizeTrialCode } from "../../../lib/trial-campaigns";
import { assignPricingExperimentsForContext } from "../../../lib/pricing-experiments";

function parseString(value: unknown, max = 200) {
  const v = String(value ?? "").trim();
  return v ? v.slice(0, max) : "";
}

function getIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip")?.trim() ?? null;
}

function normalizeBusinessType(value: unknown) {
  const v = parseString(value, 64).toLowerCase();
  const allowed = new Set(["kiosco", "distribuidora", "bar", "retail", "enterprise"]);
  return allowed.has(v) ? v : v || "retail";
}

function parseUtm(body: any, req: NextRequest) {
  const url = new URL(req.url);
  return {
    utmSource: parseString(body.utmSource ?? url.searchParams.get("utm_source") ?? "", 100) || null,
    utmCampaign: parseString(body.utmCampaign ?? url.searchParams.get("utm_campaign") ?? "", 120) || null,
    utmMedium: parseString(body.utmMedium ?? url.searchParams.get("utm_medium") ?? "", 100) || null,
    utmTerm: parseString(body.utmTerm ?? url.searchParams.get("utm_term") ?? "", 120) || null,
    utmContent: parseString(body.utmContent ?? url.searchParams.get("utm_content") ?? "", 120) || null,
    referral: parseString(body.referral ?? "", 120) || null,
    landing: parseString(body.landing ?? req.headers.get("referer") ?? "", 500) || null,
  };
}

export async function POST(req: NextRequest) {
  const requiredToken = process.env.MARKETING_SITE_INGEST_TOKEN ?? "";
  const providedToken = req.headers.get("x-marketing-site-token") ?? "";
  if (requiredToken && providedToken !== requiredToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const pricingCookieId = req.cookies.get("pxid")?.value?.trim() || crypto.randomUUID();
  const email = parseString(body.email, 200).toLowerCase();
  const businessType = normalizeBusinessType(body.businessType);
  const city = parseString(body.city, 120) || null;
  const companyName = parseString(body.companyName, 160) || null;
  const domain = normalizeHostLike(body.domain ? String(body.domain) : null);
  const trialCode = body.trial ? normalizeTrialCode(String(body.trial)) : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const instanceId = parseString(body.instanceId, 120) || null;
  const installation =
    instanceId
      ? await prisma.installation.findUnique({
          where: { instanceId },
          select: { id: true, instanceId: true },
        })
      : null;

  const utm = parseUtm(body, req);
  const ip = getIp(req);
  const userAgent = req.headers.get("user-agent") ?? null;

  const leadAttribution = await prisma.leadAttribution.create({
    data: {
      instanceId: installation?.instanceId ?? instanceId,
      companyId: body.companyId ? parseString(body.companyId, 120) : null,
      utmSource: utm.utmSource,
      utmCampaign: utm.utmCampaign,
      utmMedium: utm.utmMedium,
      utmTerm: utm.utmTerm,
      utmContent: utm.utmContent,
      referral: utm.referral,
      landing: utm.landing,
      businessType,
      ipHash: hashTrialSignal(ip),
      fingerprintHash: hashTrialSignal(body.fingerprint ? parseString(body.fingerprint, 200) : null),
    },
  });

  const lead = await prisma.marketingLead.create({
    data: {
      installationId: installation?.id ?? null,
      instanceId: installation?.instanceId ?? instanceId,
      companyId: body.companyId ? parseString(body.companyId, 120) : null,
      leadAttributionId: leadAttribution.id,
      email,
      businessType,
      city,
      trialCode,
      source: "marketing-site",
      status: trialCode ? "TRIAL_SIGNUP_REQUESTED" : "CAPTURED",
      metadata: {
        companyName,
        domain,
        userAgent,
        consentMarketing: Boolean(body.consentMarketing),
      } as any,
    },
  });

  let targetTier: string | null = null;
  if (trialCode) {
    const campaign = await prisma.trialCampaign.findUnique({ where: { code: trialCode }, select: { tier: true } }).catch(() => null);
    targetTier = campaign?.tier ?? null;
  }
  if (targetTier) {
    await assignPricingExperimentsForContext(prisma as any, {
      instanceId: installation?.instanceId ?? instanceId,
      installationId: installation?.id ?? null,
      leadAttributionId: leadAttribution.id,
      cookieId: pricingCookieId,
      emailDomain: email.split("@")[1] ?? domain,
      targetTier,
      trialCode,
      icp: businessType,
      source: "marketing_site_lead",
      actor: "marketing-site",
    }).catch(() => undefined);
  }
  const response = NextResponse.json({
    ok: true,
    lead: {
      id: lead.id,
      status: lead.status,
      trialCode: lead.trialCode,
      createdAt: lead.createdAt,
    },
    attribution: {
      id: leadAttribution.id,
      utmSource: leadAttribution.utmSource,
      utmCampaign: leadAttribution.utmCampaign,
    },
  });
  response.cookies.set("pxid", pricingCookieId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
