import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";
import { hashEvidencePayload } from "../../lib/compliance-evidence";
import { recordTrialLifecycleEvent } from "../../lib/trial-funnel-analytics";
import {
  computeEarlyChurn,
  normalizeHostLike,
  normalizeTrialCode,
  trialCampaignLink,
  type TrialTier,
} from "../../lib/trial-campaigns";

const ACTIVE_REDEMPTION_STATUSES = ["REDEEMED", "PENDING_APPROVAL"] as const;

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeHostLike(typeof item === "string" ? item : ""))
    .filter((item): item is string => Boolean(item));
}

async function buildCampaignMetrics(campaignIds: string[]) {
  if (campaignIds.length === 0) return {};
  const redemptions = await prisma.trialRedemption.findMany({
    where: { campaignId: { in: campaignIds } },
    select: {
      id: true,
      campaignId: true,
      billingAccountId: true,
      redeemedAt: true,
      status: true,
    },
    orderBy: { redeemedAt: "desc" },
  });

  const billingAccountIds = Array.from(new Set(redemptions.map((r) => r.billingAccountId).filter(Boolean) as string[]));
  const [accounts, paidInvoices] = await Promise.all([
    billingAccountIds.length
      ? prisma.billingAccount.findMany({
          where: { id: { in: billingAccountIds } },
          select: { id: true, status: true, trialEndsAt: true, updatedAt: true },
        })
      : Promise.resolve([]),
    billingAccountIds.length
      ? prisma.billingInvoice.findMany({
          where: { accountId: { in: billingAccountIds }, status: "PAID" },
          select: { accountId: true, paidAt: true },
        })
      : Promise.resolve([]),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const paidByAccount = new Set(paidInvoices.map((inv) => inv.accountId));
  const now = Date.now();
  const result: Record<string, any> = {};

  for (const redemption of redemptions) {
    const row =
      result[redemption.campaignId] ??
      (result[redemption.campaignId] = {
        redemptions: 0,
        activeTrials: 0,
        conversionsPaid: 0,
        earlyChurn: 0,
        statuses: {},
      });
    row.statuses[redemption.status] = (row.statuses[redemption.status] ?? 0) + 1;
    if ((ACTIVE_REDEMPTION_STATUSES as readonly string[]).includes(redemption.status)) {
      row.redemptions += 1;
    }
    if (!redemption.billingAccountId) continue;
    const account = accountMap.get(redemption.billingAccountId);
    if (!account) continue;

    if (account.trialEndsAt && account.trialEndsAt.getTime() > now && account.status !== "CANCELED" && account.status !== "SUSPENDED") {
      row.activeTrials += 1;
    }
    if (paidByAccount.has(account.id)) {
      row.conversionsPaid += 1;
    }
    if (account.status === "CANCELED" && computeEarlyChurn({ redeemedAt: redemption.redeemedAt, cancelledAt: account.updatedAt })) {
      row.earlyChurn += 1;
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const campaigns = await prisma.trialCampaign.findMany({ orderBy: { createdAt: "desc" } });
  const metricsById = await buildCampaignMetrics(campaigns.map((c) => c.id));
  const baseUrl = new URL(req.url).origin;
  return NextResponse.json({
    items: campaigns.map((campaign) => ({
      ...campaign,
      signupLink: trialCampaignLink(baseUrl, campaign.code),
      metrics: metricsById[campaign.id] ?? {
        redemptions: 0,
        activeTrials: 0,
        conversionsPaid: 0,
        earlyChurn: 0,
        statuses: {},
      },
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "create").trim();

  if (action === "create") {
    const code = normalizeTrialCode(String(body.code ?? ""));
    const tier = String(body.tier ?? "").trim().toUpperCase() as TrialTier;
    const durationDays = Number(body.durationDays ?? 0);
    if (!code || !["C1", "C2"].includes(tier)) {
      return NextResponse.json({ error: "code and tier(C1/C2) required" }, { status: 400 });
    }
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 120) {
      return NextResponse.json({ error: "durationDays must be between 1 and 120" }, { status: 400 });
    }
    const created = await prisma.trialCampaign.create({
      data: {
        code,
        tier,
        durationDays,
        maxRedemptions: body.maxRedemptions == null ? null : Number(body.maxRedemptions),
        expiresAt: parseOptionalDate(body.expiresAt),
        requiresApproval: Boolean(body.requiresApproval),
        allowedDomains: parseStringArray(body.allowedDomains),
        blockedDomains: parseStringArray(body.blockedDomains),
        notes: body.notes ? String(body.notes) : null,
        createdBy: body.actor ? String(body.actor) : "admin",
        updatedBy: body.actor ? String(body.actor) : "admin",
      },
    });
    return NextResponse.json(created, { status: 201 });
  }

  if (action === "revoke") {
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const updated = await prisma.trialCampaign.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        updatedBy: body.actor ? String(body.actor) : "admin",
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "extendTrial") {
    const billingAccountId = String(body.billingAccountId ?? "").trim();
    const days = Number(body.days ?? 0);
    if (!billingAccountId || !Number.isFinite(days) || days < 1 || days > 90) {
      return NextResponse.json({ error: "billingAccountId and days(1-90) required" }, { status: 400 });
    }
    const account = await prisma.billingAccount.findUnique({ where: { id: billingAccountId } });
    if (!account) return NextResponse.json({ error: "billing account not found" }, { status: 404 });
    const base = account.trialEndsAt && account.trialEndsAt > new Date() ? account.trialEndsAt : new Date();
    const nextTrialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    const updated = await prisma.billingAccount.update({
      where: { id: account.id },
      data: { trialEndsAt: nextTrialEndsAt, status: account.status === "SUSPENDED" ? "ACTIVE" : account.status },
    });

    const installationId = account.installationId ?? null;
    const payload = {
      billingAccountId: account.id,
      instanceId: account.instanceId,
      previousTrialEndsAt: account.trialEndsAt,
      nextTrialEndsAt,
      days,
      campaignId: body.campaignId ? String(body.campaignId) : null,
      reason: body.reason ? String(body.reason) : null,
    };
    await prisma.complianceEvidence.create({
      data: {
        installationId,
        evidenceType: "trial_extension",
        source: "trial_campaigns",
        payload,
        payloadHash: hashEvidencePayload(payload),
        sourceCapturedAt: new Date(),
        capturedBy: body.actor ? String(body.actor) : "admin",
        tags: ["marketing", "trial", "billing"],
      },
    });
    const redemption = await prisma.trialRedemption.findFirst({
      where: { billingAccountId: account.id },
      orderBy: { redeemedAt: "desc" },
    });
    const lead = redemption
      ? await prisma.leadAttribution.findFirst({
          where: { redemptionId: redemption.id },
          orderBy: { createdAt: "desc" },
        })
      : null;
    await recordTrialLifecycleEvent(prisma as any, {
      eventType: "TrialExtended",
      eventAt: new Date(),
      dedupeKey: `trial-extended:${account.id}:${nextTrialEndsAt.toISOString()}`,
      campaignId: redemption?.campaignId ?? null,
      redemptionId: redemption?.id ?? null,
      billingAccountId: account.id,
      installationId: account.installationId ?? null,
      instanceId: account.instanceId,
      businessType: lead?.businessType ?? null,
      source: "trial-campaigns-admin",
      properties: { previousTrialEndsAt: account.trialEndsAt, nextTrialEndsAt, days },
    }).catch(() => undefined);
    return NextResponse.json({ account: updated, trialEndsAt: nextTrialEndsAt });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
