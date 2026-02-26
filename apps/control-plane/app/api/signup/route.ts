import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { getRequestIp } from "../../lib/partner-program";
import {
  emailDomainFromAddress,
  evaluateTrialCampaignEligibility,
  hashTrialSignal,
  normalizeHostLike,
  normalizeTrialCode,
  parseList,
} from "../../lib/trial-campaigns";
import { recordTrialLifecycleEvent } from "../../lib/trial-funnel-analytics";
import { upsertCrmDealFromTrialSignup } from "../../lib/crm";
import { recordLegalAcceptances, validateSignupClickwrap } from "../../lib/legal-clickwrap";

function buildInstanceId(input: { companyName?: string | null; domain?: string | null }) {
  const base =
    (normalizeHostLike(input.domain)?.split(".")[0] ??
      (input.companyName || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24)) || "trial";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveBillingPlanForTier(tier: "C1" | "C2") {
  const plans = await prisma.billingPlan.findMany({ orderBy: { createdAt: "asc" } });
  const exact = plans.find((plan) => (plan.name || "").trim().toUpperCase() === tier);
  if (exact) return exact;
  const prefixed = plans.find((plan) => (plan.name || "").trim().toUpperCase().startsWith(`${tier} `));
  return prefixed ?? null;
}

function pickLanding(req: NextRequest, body: any) {
  if (body.landing) return String(body.landing);
  const ref = req.headers.get("referer");
  return ref || new URL(req.url).origin + "/signup";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = normalizeTrialCode(searchParams.get("trial") ?? searchParams.get("code") ?? "");
  if (!code) return NextResponse.json({ error: "trial code required" }, { status: 400 });
  const campaign = await prisma.trialCampaign.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      tier: true,
      durationDays: true,
      expiresAt: true,
      requiresApproval: true,
      allowedDomains: true,
      status: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userAgent = req.headers.get("user-agent");
  const code = normalizeTrialCode(String(body.trial ?? body.code ?? ""));
  if (!code) return NextResponse.json({ error: "trial code required" }, { status: 400 });
  const signupLegal = await validateSignupClickwrap(
    prisma as any,
    {
      acceptTos: body.acceptTos === true,
      acceptPrivacy: body.acceptPrivacy === true,
      locale: body.locale ? String(body.locale) : "es",
    },
    new Date(),
  ).catch((error: Error) => error);
  if (signupLegal instanceof Error) {
    return NextResponse.json({ error: signupLegal.message }, { status: 400 });
  }

  const campaign = await prisma.trialCampaign.findUnique({ where: { code } });
  if (!campaign) return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  const email = body.email ? String(body.email).trim() : null;
  const companyName = body.companyName ? String(body.companyName).trim() : null;
  const domain = normalizeHostLike(body.domain ? String(body.domain) : null);
  const instanceId = String(body.instanceId ?? "").trim() || buildInstanceId({ companyName, domain });
  const fingerprint = body.fingerprint ? String(body.fingerprint) : null;
  const ip = getRequestIp(req);
  const ipHash = hashTrialSignal(ip);
  const fingerprintHash = hashTrialSignal(fingerprint);
  const emailDomain = emailDomainFromAddress(email) ?? domain;

  const globalBlockedDomains = parseList(process.env.TRIAL_CAMPAIGN_BLOCKED_DOMAINS);
  const blockedFingerprints = (process.env.TRIAL_CAMPAIGN_BLOCKED_FINGERPRINTS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const rateLimitMaxAttempts = Number(process.env.TRIAL_CAMPAIGN_SIGNUP_MAX_ATTEMPTS_PER_HOUR ?? 5);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [redeemedCount, existingByDomain, existingByFingerprint, recentAttemptsFromIp] = await Promise.all([
    prisma.trialRedemption.count({
      where: {
        campaignId: campaign.id,
        status: { in: ["REDEEMED", "PENDING_APPROVAL"] },
      },
    }),
    emailDomain
      ? prisma.trialRedemption.count({
          where: {
            emailDomain,
            status: { in: ["REDEEMED", "PENDING_APPROVAL"] },
          },
        })
      : Promise.resolve(0),
    fingerprintHash
      ? prisma.trialRedemption.count({
          where: {
            fingerprintHash,
            status: { in: ["REDEEMED", "PENDING_APPROVAL"] },
          },
        })
      : Promise.resolve(0),
    ipHash
      ? prisma.trialRedemption.count({
          where: {
            ipHash,
            redeemedAt: { gte: oneHourAgo },
          },
        })
      : Promise.resolve(0),
  ]);

  const decision = evaluateTrialCampaignEligibility({
    now: new Date(),
    campaign,
    redeemedCount,
    emailDomain,
    fingerprintHash,
    existingByDomain,
    existingByFingerprint,
    recentAttemptsFromIp,
    maxAttemptsPerHour: Number.isFinite(rateLimitMaxAttempts) ? rateLimitMaxAttempts : 5,
    globalBlockedDomains,
    blockedFingerprints,
  });

  let installation = await prisma.installation.findUnique({ where: { instanceId } });
  if (!installation && decision.ok) {
    installation = await prisma.installation.create({
      data: {
        instanceId,
        clientName: companyName,
        domain,
        releaseChannel: "stable",
        healthStatus: "provisioning",
      },
    });
  }

  const leadAttribution = await prisma.leadAttribution.create({
    data: {
      campaignId: campaign.id,
      companyId: body.companyId ? String(body.companyId) : null,
      instanceId: decision.ok ? instanceId : null,
      utmSource: body.utmSource ? String(body.utmSource) : null,
      utmCampaign: body.utmCampaign ? String(body.utmCampaign) : null,
      referral: body.referral ? String(body.referral) : null,
      landing: pickLanding(req, body),
      utmMedium: body.utmMedium ? String(body.utmMedium) : null,
      utmTerm: body.utmTerm ? String(body.utmTerm) : null,
      utmContent: body.utmContent ? String(body.utmContent) : null,
      businessType: body.businessType ? String(body.businessType) : null,
      ipHash,
      fingerprintHash,
    },
  });

  if (!decision.ok) {
    const redemption = await prisma.trialRedemption.create({
      data: {
        campaignId: campaign.id,
        companyId: body.companyId ? String(body.companyId) : null,
        email,
        emailDomain,
        ipHash,
        fingerprintHash,
        status: decision.status,
        reason: decision.reason,
        metadata: {
          leadAttributionId: leadAttribution.id,
          companyName,
          domain,
          instanceId,
          cuit: body.cuit ?? null,
          phone: body.phone ?? null,
        },
      },
    });
    await prisma.leadAttribution.update({ where: { id: leadAttribution.id }, data: { redemptionId: redemption.id } });
    return NextResponse.json(
      {
        error: decision.reason,
        status: decision.status,
      },
      { status: decision.status === "EXPIRED" ? 410 : 409 },
    );
  }

  if (!installation) {
    return NextResponse.json({ error: "installation could not be created" }, { status: 500 });
  }

  const existingAccount = await prisma.billingAccount.findUnique({ where: { instanceId } });
  if (existingAccount) {
    const redemption = await prisma.trialRedemption.create({
      data: {
        campaignId: campaign.id,
        companyId: body.companyId ? String(body.companyId) : null,
        instanceId,
        billingAccountId: existingAccount.id,
        email,
        emailDomain,
        ipHash,
        fingerprintHash,
        status: "BLOCKED",
        reason: "instance_already_registered",
        metadata: { leadAttributionId: leadAttribution.id },
      },
    });
    await prisma.leadAttribution.update({ where: { id: leadAttribution.id }, data: { redemptionId: redemption.id, instanceId } });
    return NextResponse.json({ error: "instance already registered" }, { status: 409 });
  }

  const plan = await resolveBillingPlanForTier(campaign.tier as "C1" | "C2");
  if (!plan) {
    return NextResponse.json({ error: `billing plan for tier ${campaign.tier} not found` }, { status: 500 });
  }

  const now = new Date();
  const cycleDays = plan.period === "YEARLY" ? 365 : 30;
  const trialEndsAt = new Date(now.getTime() + campaign.durationDays * 24 * 60 * 60 * 1000);
  const billingAccount =
    decision.status === "PENDING_APPROVAL"
      ? null
      : await prisma.billingAccount.create({
          data: {
            installationId: installation.id,
            instanceId,
            clientName: companyName,
            email,
            planId: plan.id,
            status: "ACTIVE",
            provider: "MANUAL",
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000),
            nextBillingAt: new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000),
            trialEndsAt,
          },
        });

  const redemption = await prisma.trialRedemption.create({
    data: {
      campaignId: campaign.id,
      companyId: body.companyId ? String(body.companyId) : null,
      instanceId,
      billingAccountId: billingAccount?.id ?? null,
      email,
      emailDomain,
      ipHash,
      fingerprintHash,
      status: decision.status,
      reason: null,
      metadata: {
        leadAttributionId: leadAttribution.id,
        companyName,
        domain,
        cuit: body.cuit ?? null,
        phone: body.phone ?? null,
        requestedTier: campaign.tier,
      },
    },
  });
  await prisma.leadAttribution.update({
    where: { id: leadAttribution.id },
    data: {
      redemptionId: redemption.id,
      instanceId,
      companyId: body.companyId ? String(body.companyId) : null,
    },
  });

  // Internal CRM automation: every successful trial redemption creates/updates a deal in TRIAL stage.
  await upsertCrmDealFromTrialSignup(prisma as any, {
    campaignId: campaign.id,
    redemptionId: redemption.id,
    installationId: installation.id,
    instanceId,
    companyId: body.companyId ? String(body.companyId) : null,
    billingAccountId: billingAccount?.id ?? null,
    leadAttributionId: leadAttribution.id,
    email,
    businessType: body.businessType ? String(body.businessType) : null,
    city: body.city ? String(body.city) : null,
    companyName,
  }).catch(() => undefined);

  await recordLegalAcceptances(prisma as any, {
    documents: signupLegal.documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      version: doc.version,
      locale: doc.locale,
      contentHash: doc.contentHash,
    })),
    installationId: installation.id,
    billingAccountId: billingAccount?.id ?? null,
    companyId: body.companyId ? String(body.companyId) : null,
    userId: email ?? null,
    ip,
    userAgent,
    source: "trial_signup",
    actor: "public-signup",
    metadata: {
      trialCode: campaign.code,
      redemptionId: redemption.id,
      status: decision.status,
    },
  }).catch(() => undefined);

  if (billingAccount && decision.status === "REDEEMED") {
    await recordTrialLifecycleEvent(prisma as any, {
      eventType: "TrialStarted",
      eventAt: now,
      dedupeKey: `trial-started:${billingAccount.id}`,
      campaignId: campaign.id,
      redemptionId: redemption.id,
      billingAccountId: billingAccount.id,
      installationId: installation.id,
      instanceId: billingAccount.instanceId,
      businessType: body.businessType ? String(body.businessType) : null,
      source: "public-signup",
      properties: {
        tier: campaign.tier,
        durationDays: campaign.durationDays,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    status: decision.status,
    legalAcceptances: signupLegal.documents.map((doc) => ({
      type: doc.type,
      version: doc.version,
      locale: doc.locale,
      effectiveAt: doc.effectiveAt,
    })),
    campaign: {
      code: campaign.code,
      tier: campaign.tier,
      durationDays: campaign.durationDays,
    },
    account: billingAccount
      ? {
          billingAccountId: billingAccount.id,
          instanceId: billingAccount.instanceId,
          trialEndsAt: billingAccount.trialEndsAt,
        }
      : null,
    redemptionId: redemption.id,
    leadAttributionId: leadAttribution.id,
  });
}
