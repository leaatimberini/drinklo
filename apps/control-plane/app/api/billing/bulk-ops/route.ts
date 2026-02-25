import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import {
  buildBulkActionManifest,
  canRequestBulkAction,
  getControlPlaneActor,
  getControlPlaneRoleFromRequest,
  resolveApprovalsNeeded,
  signBulkActionManifest,
  uniqueSorted,
  validateBulkPayload,
  type BulkActionKind,
} from "../../../lib/billing-bulk-ops";
import { hashEvidencePayload } from "../../../lib/compliance-evidence";

const ACTIVE_REDEMPTION_STATUSES = ["REDEEMED", "PENDING_APPROVAL"] as const;

async function resolveTargetInstanceIds(input: { instanceIds: string[]; campaignId?: string | null }) {
  const resolved = new Set<string>(input.instanceIds);

  if (input.campaignId) {
    const redemptions = await prisma.trialRedemption.findMany({
      where: {
        campaignId: input.campaignId,
        status: { in: [...ACTIVE_REDEMPTION_STATUSES] },
      },
      select: {
        instanceId: true,
        billingAccountId: true,
      },
    });

    for (const redemption of redemptions) {
      if (redemption.instanceId) resolved.add(redemption.instanceId);
    }

    const accountIds = Array.from(new Set(redemptions.map((r) => r.billingAccountId).filter(Boolean) as string[]));
    if (accountIds.length) {
      const accounts = await prisma.billingAccount.findMany({
        where: { id: { in: accountIds } },
        select: { instanceId: true },
      });
      for (const account of accounts) resolved.add(account.instanceId);
    }
  }

  return uniqueSorted(resolved);
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const role = getControlPlaneRoleFromRequest(req);
  if (!role) return unauthorized();
  if (!canRequestBulkAction(role, "SET_TIER")) return unauthorized();

  const [actions, campaigns, plans] = await Promise.all([
    prisma.bulkBillingAction.findMany({
      include: {
        approvals: {
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.trialCampaign.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, code: true, tier: true, status: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.billingPlan.findMany({
      select: { id: true, name: true, price: true, currency: true, period: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    role,
    campaigns,
    plans,
    actions,
  });
}

export async function POST(req: NextRequest) {
  const role = getControlPlaneRoleFromRequest(req);
  if (!role) return unauthorized();
  const actor = getControlPlaneActor(req);
  const body = await req.json().catch(() => ({}));

  if (body?.action !== "create") {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  if (body?.confirmed !== true) {
    return NextResponse.json({ error: "confirmation required" }, { status: 400 });
  }

  let normalized;
  try {
    normalized = validateBulkPayload({
      actionType: String(body.actionType ?? "").trim().toUpperCase() as BulkActionKind,
      instanceIds: body.instanceIds,
      campaignId: body.campaignId ?? null,
      targetTier: body.targetTier ?? null,
      trialExtensionDays: body.trialExtensionDays ?? null,
      reason: body.reason ?? null,
      metadata: body.metadata ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "invalid payload" }, { status: 400 });
  }

  if (!canRequestBulkAction(role, normalized.actionType)) {
    return unauthorized();
  }

  if ((normalized.actionType === "FRAUD_PAUSE" || normalized.actionType === "FRAUD_CANCEL") && !normalized.reason?.trim()) {
    return NextResponse.json({ error: "reason is required for fraud bulk actions" }, { status: 400 });
  }

  const resolvedInstanceIds = await resolveTargetInstanceIds({
    instanceIds: normalized.instanceIds,
    campaignId: normalized.campaignId,
  });
  if (resolvedInstanceIds.length === 0) {
    return NextResponse.json({ error: "no target instances resolved" }, { status: 400 });
  }

  const approvalsNeeded = resolveApprovalsNeeded({
    requireTwoPersonApproval: Boolean(body.requireTwoPersonApproval),
    targetCount: resolvedInstanceIds.length,
  });
  const requiresTwoPersonApproval = approvalsNeeded >= 2;

  const manifest = buildBulkActionManifest({
    actionType: normalized.actionType,
    instanceIds: resolvedInstanceIds,
    campaignId: normalized.campaignId,
    targetTier: normalized.targetTier,
    trialExtensionDays: normalized.trialExtensionDays,
    reason: normalized.reason,
    requestedByRole: role,
    requestedByActor: actor,
    approvalsNeeded,
    requiresTwoPersonApproval,
  });
  const { manifestHash, evidenceSignature } = signBulkActionManifest(manifest);

  const payload = {
    ...normalized,
    resolvedInstanceIds,
    manifest,
    createdAt: new Date().toISOString(),
    requestedBy: { role, actor },
  };

  const created = await prisma.bulkBillingAction.create({
    data: {
      actionType: normalized.actionType,
      status: "PENDING_APPROVAL",
      requestedByRole: role,
      requestedByActor: actor,
      approvalsNeeded,
      requiresTwoPersonApproval,
      manifestHash,
      evidenceSignature,
      targetCount: resolvedInstanceIds.length,
      payload: payload as any,
      note: normalized.reason ?? null,
    },
  });

  await prisma.complianceEvidence.create({
    data: {
      evidenceType: "billing.bulk_action.request",
      source: "control-plane",
      payload: {
        actionId: created.id,
        manifest,
        manifestHash,
        evidenceSignature,
        requestedByRole: role,
        requestedByActor: actor,
      } as any,
      payloadHash: hashEvidencePayload({
        actionId: created.id,
        manifestHash,
        evidenceSignature,
        manifest,
      }),
      sourceCapturedAt: new Date(),
      capturedBy: actor ?? role,
      tags: ["billing", "bulk-ops", String(normalized.actionType).toLowerCase()],
    },
  });

  return NextResponse.json(
    {
      ok: true,
      action: created,
      manifest,
      approvalsNeeded,
      requiresTwoPersonApproval,
      targetPreview: resolvedInstanceIds.slice(0, 20),
      targetOverflow: Math.max(0, resolvedInstanceIds.length - 20),
    },
    { status: 201 },
  );
}
