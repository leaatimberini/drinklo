import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { calculateDynamicPricing, calculateProration, evaluateTrialAndEnforcement } from "../../lib/billing-advanced";
import {
  applyCommissionForInvoice,
  detectBasicLeadFraud,
  emailDomain,
  getRequestIp,
  normalizeDomain,
  parseAttributionCookie,
  resolveAttributionForAccountCreation,
} from "../../lib/partner-program";

function requireToken(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.CONTROL_PLANE_ADMIN_TOKEN ?? "";
  return token && expected && token === expected;
}

export async function GET(req: NextRequest) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const plans = await prisma.billingPlan.findMany({ orderBy: { createdAt: "desc" } });
  const accounts = await prisma.billingAccount.findMany({
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 5 },
      usageRecords: { orderBy: { createdAt: "desc" }, take: 10 },
      planChanges: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ plans, accounts });
}

export async function POST(req: NextRequest) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!body?.kind) return NextResponse.json({ error: "kind required" }, { status: 400 });

  if (body.kind === "plan") {
    const plan = await prisma.billingPlan.create({
      data: {
        name: body.name,
        price: body.price,
        currency: body.currency,
      period: body.period,
      features: body.features ?? [],
      trialDays: body.trialDays ?? 0,
      includedOrdersPerMonth: body.includedOrdersPerMonth ?? 0,
      gmvIncludedArs: body.gmvIncludedArs ?? 0,
      overagePerOrderArs: body.overagePerOrderArs ?? 0,
      gmvTiers: body.gmvTiers ?? null,
      rpoTargetMin: body.rpoTargetMin ?? null,
      rtoTargetMin: body.rtoTargetMin ?? null,
    },
    });
    return NextResponse.json(plan);
  }

  if (body.kind === "account") {
    const installation = await prisma.installation.findUnique({ where: { instanceId: body.instanceId } });
    if (!installation) return NextResponse.json({ error: "installation not found" }, { status: 404 });
    const plan = await prisma.billingPlan.findUnique({ where: { id: body.planId } });
    if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
    const account = await prisma.billingAccount.create({
      include: { plan: true },
      data: {
        installationId: installation.id,
        instanceId: body.instanceId,
        clientName: body.clientName ?? null,
        email: body.email ?? null,
        planId: body.planId,
        status: body.status ?? "ACTIVE",
        provider: body.provider ?? "MANUAL",
        nextBillingAt: body.nextBillingAt ? new Date(body.nextBillingAt) : null,
        trialEndsAt:
          (plan.trialDays ?? 0) > 0
            ? new Date(Date.now() + Number(plan.trialDays) * 24 * 60 * 60 * 1000)
            : null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (plan.period === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.installation.update({
      where: { id: installation.id },
      data: {
        clientName: body.clientName ?? installation.clientName ?? null,
        drPlan: plan.name,
        rpoTargetMin: plan.rpoTargetMin ?? undefined,
        rtoTargetMin: plan.rtoTargetMin ?? undefined,
      },
    });
    await attachPartnerConversionIfAny(req, {
      accountId: account.id,
      installationId: installation.id,
      instanceId: account.instanceId,
      email: account.email,
      installationDomain: installation.domain,
      attribution: body.attribution ?? null,
    });
    return NextResponse.json(account);
  }

  if (body.kind === "usage") {
    const account = await prisma.billingAccount.findUnique({
      where: { instanceId: String(body.instanceId ?? "") },
      include: { plan: true, invoices: { where: { status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 1 } },
    });
    if (!account) return NextResponse.json({ error: "account not found" }, { status: 404 });
    const monthlyOrders = Math.max(0, account.monthlyOrders + Number(body.ordersDelta ?? 0));
    const monthlyGmvArs = Math.max(0, account.monthlyGmvArs + Number(body.gmvDeltaArs ?? 0));
    const pricing = calculateDynamicPricing(
      {
        basePrice: account.plan.price,
        includedOrdersPerMonth: account.plan.includedOrdersPerMonth,
        overagePerOrderArs: account.plan.overagePerOrderArs,
        gmvIncludedArs: account.plan.gmvIncludedArs,
        gmvTiers: (account.plan.gmvTiers as any) ?? [],
      },
      { monthlyOrders, monthlyGmvArs },
    );
    const due = account.invoices[0]?.dueAt;
    const pastDueDays = due ? Math.max(0, Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000))) : 0;
    const enforcement = evaluateTrialAndEnforcement({
      now: new Date(),
      trialEndsAt: account.trialEndsAt,
      invoicePastDueDays: pastDueDays,
      premiumFeaturesEnabled: true,
    });

    const updated = await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        monthlyOrders,
        monthlyGmvArs,
        warningCount: account.warningCount + (enforcement.warnings.length > 0 ? 1 : 0),
        softLimitedAt: enforcement.softLimitPremium ? new Date() : null,
        hardLimitedAt: enforcement.hardLimitPremium ? new Date() : null,
      },
    });

    await prisma.billingUsageRecord.create({
      data: {
        accountId: account.id,
        periodStart: account.currentPeriodStart ?? new Date(),
        periodEnd: account.currentPeriodEnd ?? new Date(),
        ordersCount: monthlyOrders,
        gmvArs: monthlyGmvArs,
        estimatedAmount: pricing.totalArs,
      },
    });

    return NextResponse.json({ account: updated, pricing, enforcement });
  }

  if (body.kind === "changePlan") {
    const instanceId = String(body.instanceId ?? "").trim();
    const targetPlanId = String(body.targetPlanId ?? "").trim();
    if (!instanceId || !targetPlanId) {
      return NextResponse.json({ error: "instanceId and targetPlanId required" }, { status: 400 });
    }
    const account = await prisma.billingAccount.findUnique({
      where: { instanceId },
      include: { plan: true },
    });
    if (!account) return NextResponse.json({ error: "account not found" }, { status: 404 });
    const targetPlan = await prisma.billingPlan.findUnique({ where: { id: targetPlanId } });
    if (!targetPlan) return NextResponse.json({ error: "target plan not found" }, { status: 404 });
    if (targetPlan.id === account.planId) {
      return NextResponse.json({ error: "plan unchanged" }, { status: 400 });
    }

    const now = new Date();
    const periodStart = account.currentPeriodStart ?? account.createdAt;
    const periodEnd = account.currentPeriodEnd ?? new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    const proration = calculateProration({
      fromPlanAmount: account.plan.price,
      toPlanAmount: targetPlan.price,
      periodStart,
      periodEnd,
      effectiveAt: now,
    });
    const updated = await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        planId: targetPlan.id,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + (targetPlan.period === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
        nextBillingAt: new Date(now.getTime() + (targetPlan.period === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });
    await prisma.billingPlanChange.create({
      data: {
        accountId: updated.id,
        fromPlanId: account.planId,
        toPlanId: targetPlan.id,
        prorationAmount: proration.prorationAmount,
        reason: body.reason ?? "customer_request",
      },
    });

    if (proration.prorationAmount !== 0) {
      const invoice = await prisma.billingInvoice.create({
        data: {
          accountId: updated.id,
          amount: Math.abs(proration.prorationAmount),
          currency: targetPlan.currency,
          status: proration.prorationAmount > 0 ? "OPEN" : "PAID",
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          paidAt: proration.prorationAmount < 0 ? now : null,
          provider: updated.provider,
          externalId: null,
        },
      });
      await applyCommissionForInvoice({
        prisma,
        billingAccountId: updated.id,
        invoiceAmount: invoice.amount,
        currency: invoice.currency,
      });
    }

    return NextResponse.json({ account: updated, proration });
  }

  return NextResponse.json({ error: "unsupported kind" }, { status: 400 });
}

async function attachPartnerConversionIfAny(
  req: NextRequest,
  input: {
    accountId: string;
    installationId: string;
    instanceId: string;
    email?: string | null;
    installationDomain?: string | null;
    attribution?: any;
  },
) {
  const existing = await prisma.conversion.findUnique({
    where: { billingAccountId: input.accountId },
  });
  if (existing) return existing;

  const cookie = parseAttributionCookie(req.cookies.get("pp_attr")?.value);
  const resolved = resolveAttributionForAccountCreation({
    cookie,
    referralCode: input.attribution?.referralCode ?? null,
    utm: {
      utmSource: input.attribution?.utmSource ?? input.attribution?.utm_source ?? null,
      utmMedium: input.attribution?.utmMedium ?? input.attribution?.utm_medium ?? null,
      utmCampaign: input.attribution?.utmCampaign ?? input.attribution?.utm_campaign ?? null,
      utmTerm: input.attribution?.utmTerm ?? input.attribution?.utm_term ?? null,
      utmContent: input.attribution?.utmContent ?? input.attribution?.utm_content ?? null,
    },
  });
  if (!resolved.hasAttribution) return null;

  let referralLink =
    resolved.referralCode
      ? await prisma.referralLink.findUnique({
          where: { code: resolved.referralCode },
          include: { partner: true, commissionPlan: true },
        })
      : null;

  if (!referralLink && resolved.partnerSlug) {
    referralLink = await prisma.referralLink.findFirst({
      where: { partner: { slug: resolved.partnerSlug }, status: "ACTIVE" },
      include: { partner: true, commissionPlan: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!referralLink || referralLink.partner.status !== "ACTIVE") return null;

  const lead =
    (resolved.leadId
      ? await prisma.lead.findFirst({
          where: { id: resolved.leadId, partnerId: referralLink.partnerId },
        })
      : null) ??
    (resolved.leadId
      ? null
      : await prisma.lead.create({
          data: {
            partnerId: referralLink.partnerId,
            referralLinkId: referralLink.id,
            email: input.email ?? null,
            emailDomain: emailDomain(input.email) ?? null,
            installationDomain: normalizeDomain(input.installationDomain) ?? null,
            utmSource: resolved.utmSource ?? null,
            utmMedium: resolved.utmMedium ?? null,
            utmCampaign: resolved.utmCampaign ?? null,
            utmTerm: resolved.utmTerm ?? null,
            utmContent: resolved.utmContent ?? null,
            status: "QUALIFIED",
            ipAddress: getRequestIp(req),
            metadata: { createdFrom: "billing-account" },
          },
        }));

  const fraud = detectBasicLeadFraud({
    partnerWebsiteDomain: referralLink.partner.websiteDomain,
    clickIp: lead?.ipAddress ?? null,
    accountIp: getRequestIp(req),
    accountEmail: input.email ?? null,
    installationDomain: input.installationDomain ?? null,
  });

  const commissionPlan =
    referralLink.commissionPlan ??
    (await prisma.commissionPlan.findFirst({
      where: { partnerId: referralLink.partnerId, active: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }));

  const conversion = await prisma.conversion.create({
    data: {
      partnerId: referralLink.partnerId,
      referralLinkId: referralLink.id,
      leadId: lead?.id ?? null,
      commissionPlanId: commissionPlan?.id ?? null,
      installationId: input.installationId,
      billingAccountId: input.accountId,
      instanceId: input.instanceId,
      status: fraud.flags.length ? "REVIEW" : "ATTRIBUTED",
      attributionSource: resolved.source,
      accountCreationIp: getRequestIp(req),
      accountEmailDomain: emailDomain(input.email) ?? null,
      installationDomain: normalizeDomain(input.installationDomain) ?? null,
      fraudScore: fraud.score,
      fraudFlags: fraud.flags.length ? fraud.flags : undefined,
      commissionCurrency: commissionPlan?.currency ?? "ARS",
      commissionSnapshot: commissionPlan
        ? {
            id: commissionPlan.id,
            name: commissionPlan.name,
            type: commissionPlan.type,
            percentRate: commissionPlan.percentRate,
            flatAmount: commissionPlan.flatAmount,
            recurringInvoiceCap: commissionPlan.recurringInvoiceCap,
          }
        : undefined,
      metadata: {
        utmSource: resolved.utmSource,
        utmMedium: resolved.utmMedium,
        utmCampaign: resolved.utmCampaign,
        utmTerm: resolved.utmTerm,
        utmContent: resolved.utmContent,
      },
    },
  });

  if (lead && lead.status !== "CONVERTED") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });
  }
  return conversion;
}
