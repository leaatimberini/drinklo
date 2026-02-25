import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../lib/generated/prisma";
import { prisma } from "../../../../lib/prisma";
import {
  canApproveBulkAction,
  canRequestBulkAction,
  getControlPlaneActor,
  getControlPlaneRoleFromRequest,
  signBulkActionManifest,
  type BulkActionKind,
} from "../../../../lib/billing-bulk-ops";
import { hashEvidencePayload } from "../../../../lib/compliance-evidence";
import { recordTrialLifecycleEvent } from "../../../../lib/trial-funnel-analytics";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function readActionPayload(action: any) {
  const payload = (action?.payload ?? {}) as any;
  return {
    actionType: String(action.actionType ?? payload.actionType ?? "").trim().toUpperCase() as BulkActionKind,
    resolvedInstanceIds: Array.isArray(payload.resolvedInstanceIds)
      ? payload.resolvedInstanceIds.map((v: any) => String(v)).filter(Boolean)
      : [],
    targetTier: payload.targetTier ? String(payload.targetTier).trim().toUpperCase() : null,
    trialExtensionDays: payload.trialExtensionDays == null ? null : Number(payload.trialExtensionDays),
    campaignId: payload.campaignId ? String(payload.campaignId) : null,
    reason: payload.reason ? String(payload.reason) : null,
    manifest: payload.manifest ?? null,
  };
}

async function findPlanByTier(tx: Prisma.TransactionClient, tier: string) {
  const exact = await tx.billingPlan.findFirst({
    where: { name: { equals: tier, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (exact) return exact;
  return tx.billingPlan.findFirst({
    where: { name: { contains: tier, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
}

async function createExecutionEvidence(input: {
  actionId: string;
  manifestHash: string;
  eventType: string;
  role: string;
  actor?: string | null;
  payload: Record<string, unknown>;
}) {
  const { manifestHash, evidenceSignature } = signBulkActionManifest(input.payload);
  await prisma.complianceEvidence.create({
    data: {
      evidenceType: input.eventType,
      source: "control-plane",
      payload: {
        actionId: input.actionId,
        sourceManifestHash: input.manifestHash,
        generatedManifestHash: manifestHash,
        evidenceSignature,
        ...input.payload,
      } as any,
      payloadHash: hashEvidencePayload({
        actionId: input.actionId,
        sourceManifestHash: input.manifestHash,
        generatedManifestHash: manifestHash,
        ...input.payload,
      }),
      sourceCapturedAt: new Date(),
      capturedBy: input.actor ?? input.role,
      tags: ["billing", "bulk-ops", input.eventType],
    },
  });
}

async function executeBulkAction(action: any, role: string, actor?: string | null) {
  const payload = readActionPayload(action);
  const now = new Date();
  const targetInstanceIds: string[] = payload.resolvedInstanceIds;
  if (targetInstanceIds.length === 0) {
    throw new Error("bulk action has no resolved targets");
  }
  if (!canRequestBulkAction(role as any, payload.actionType)) {
    throw new Error("role_not_allowed_to_execute");
  }

  const accounts = await prisma.billingAccount.findMany({
    where: { instanceId: { in: targetInstanceIds } },
    include: {
      plan: { select: { id: true, name: true, price: true } },
      installation: { select: { id: true, instanceId: true, domain: true, clientName: true } },
    },
  });
  const accountByInstance = new Map(accounts.map((acc) => [acc.instanceId, acc]));
  const missingInstances = targetInstanceIds.filter((instanceId: string) => !accountByInstance.has(instanceId));

  const summary: any = {
    actionType: payload.actionType,
    requestedTargetCount: targetInstanceIds.length,
    foundAccounts: accounts.length,
    missingInstances,
    updated: 0,
    skipped: 0,
    alertsCreated: 0,
    planChangesCreated: 0,
    samples: [] as any[],
  };

  if (payload.actionType === "SET_TIER") {
    if (!payload.targetTier) throw new Error("targetTier_missing");
    const result = await prisma.$transaction(async (tx) => {
      const plan = await findPlanByTier(tx, payload.targetTier!);
      if (!plan) throw new Error(`target_plan_not_found:${payload.targetTier}`);

      for (const instanceId of targetInstanceIds) {
        const account = accountByInstance.get(instanceId);
        if (!account) continue;
        if (account.planId === plan.id) {
          summary.skipped += 1;
          continue;
        }

        const updated = await tx.billingAccount.update({
          where: { id: account.id },
          data: {
            planId: plan.id,
            updatedAt: now,
          },
          include: { plan: true },
        });
        await tx.billingPlanChange.create({
          data: {
            accountId: account.id,
            fromPlanId: account.planId,
            toPlanId: plan.id,
            effectiveAt: now,
            prorationAmount: 0,
            reason: payload.reason ?? "bulk_support_plan_change",
          },
        });
        await tx.alert.create({
          data: {
            installationId: account.installationId,
            level: "info",
            message: `Bulk billing set tier: ${account.plan.name} -> ${updated.plan.name}`,
          },
        });
        summary.updated += 1;
        summary.alertsCreated += 1;
        summary.planChangesCreated += 1;
        if (summary.samples.length < 20) {
          summary.samples.push({
            instanceId,
            fromPlan: account.plan.name,
            toPlan: updated.plan.name,
          });
        }
      }
      return { targetPlanId: plan.id, targetPlanName: plan.name };
    });
    summary.targetPlan = result.targetPlanName;
  } else if (payload.actionType === "EXTEND_TRIAL") {
    const days = Number(payload.trialExtensionDays ?? 0);
    if (!Number.isFinite(days) || days <= 0) throw new Error("trialExtensionDays_invalid");
    const extendedRows: Array<{
      accountId: string;
      installationId: string;
      instanceId: string;
      previousTrialEndsAt: Date | null;
      nextTrialEndsAt: Date;
    }> = [];

    await prisma.$transaction(async (tx) => {
      for (const instanceId of targetInstanceIds) {
        const account = accountByInstance.get(instanceId);
        if (!account) continue;
        const base = account.trialEndsAt && account.trialEndsAt > now ? account.trialEndsAt : now;
        const nextTrialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        await tx.billingAccount.update({
          where: { id: account.id },
          data: { trialEndsAt: nextTrialEndsAt },
        });
        await tx.alert.create({
          data: {
            installationId: account.installationId,
            level: "info",
            message: `Bulk trial extension applied (+${days}d)`,
          },
        });
        extendedRows.push({
          accountId: account.id,
          installationId: account.installationId,
          instanceId: account.instanceId,
          previousTrialEndsAt: account.trialEndsAt,
          nextTrialEndsAt,
        });
        summary.updated += 1;
        summary.alertsCreated += 1;
        if (summary.samples.length < 20) {
          summary.samples.push({
            instanceId,
            previousTrialEndsAt: account.trialEndsAt,
            nextTrialEndsAt,
          });
        }
      }
    });

    await Promise.all(
      extendedRows.map((row) =>
        recordTrialLifecycleEvent(prisma as any, {
          eventType: "TrialExtended",
          eventAt: now,
          dedupeKey: `bulk-trial-extended:${action.id}:${row.accountId}:${row.nextTrialEndsAt.toISOString()}`,
          campaignId: payload.campaignId ?? null,
          billingAccountId: row.accountId,
          installationId: row.installationId,
          instanceId: row.instanceId,
          source: "control-plane-bulk-ops",
          properties: {
            days,
            actionId: action.id,
            previousTrialEndsAt: row.previousTrialEndsAt,
            nextTrialEndsAt: row.nextTrialEndsAt,
          },
        }).catch(() => undefined),
      ),
    );
  } else if (payload.actionType === "FRAUD_PAUSE" || payload.actionType === "FRAUD_CANCEL") {
    const targetStatus = payload.actionType === "FRAUD_PAUSE" ? "SUSPENDED" : "CANCELED";
    const alertLevel = payload.actionType === "FRAUD_PAUSE" ? "warning" : "critical";
    await prisma.$transaction(async (tx) => {
      for (const instanceId of targetInstanceIds) {
        const account = accountByInstance.get(instanceId);
        if (!account) continue;
        if (account.status === targetStatus) {
          summary.skipped += 1;
          continue;
        }
        await tx.billingAccount.update({
          where: { id: account.id },
          data: { status: targetStatus as any },
        });
        await tx.alert.create({
          data: {
            installationId: account.installationId,
            level: alertLevel,
            message: `Billing account ${targetStatus.toLowerCase()} by fraud bulk action`,
          },
        });
        summary.updated += 1;
        summary.alertsCreated += 1;
        if (summary.samples.length < 20) {
          summary.samples.push({
            instanceId,
            previousStatus: account.status,
            nextStatus: targetStatus,
          });
        }
      }
    });
  } else {
    throw new Error(`unsupported_action:${payload.actionType}`);
  }

  await createExecutionEvidence({
    actionId: action.id,
    manifestHash: action.manifestHash,
    eventType: "billing.bulk_action.execution",
    role,
    actor,
    payload: {
      actionType: payload.actionType,
      targetCount: targetInstanceIds.length,
      summary,
      executedAt: now.toISOString(),
    },
  });

  return summary;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const role = getControlPlaneRoleFromRequest(req);
  if (!role) return unauthorized();
  const actor = getControlPlaneActor(req);
  const { id: rawId } = await context.params;
  const id = String(rawId ?? "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const actionCommand = String(body.action ?? "").trim().toLowerCase();
  if (!["approve", "reject", "execute"].includes(actionCommand)) {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }

  const action = await prisma.bulkBillingAction.findUnique({
    where: { id },
    include: { approvals: { orderBy: { createdAt: "asc" } } },
  });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });
  const payload = readActionPayload(action);

  if (actionCommand === "approve" || actionCommand === "reject") {
    if (action.status === "EXECUTED" || action.status === "FAILED" || action.status === "REJECTED") {
      return NextResponse.json({ error: `action already ${action.status.toLowerCase()}` }, { status: 409 });
    }
    const decision = actionCommand === "approve" ? "APPROVE" : "REJECT";

    if (decision === "APPROVE") {
      const approvalCheck = canApproveBulkAction({
        role,
        actionType: payload.actionType,
        requestedByRole: action.requestedByRole,
        requestedByActor: action.requestedByActor,
        approverActor: actor,
        requiresTwoPersonApproval: action.requiresTwoPersonApproval,
        existingApproverRoles: action.approvals.filter((a) => a.decision === "APPROVE").map((a) => a.approverRole),
      });
      if (!approvalCheck.ok) {
        return NextResponse.json({ error: approvalCheck.reason }, { status: 403 });
      }
    } else if (!canRequestBulkAction(role, payload.actionType)) {
      return unauthorized();
    }

    const approvalPayload = {
      actionId: action.id,
      decision,
      note: body.note ? String(body.note) : null,
      approverRole: role,
      approverActor: actor,
      manifestHash: action.manifestHash,
      actionType: payload.actionType,
      approvedAt: new Date().toISOString(),
    };
    const { evidenceSignature } = signBulkActionManifest(approvalPayload);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const approval = await tx.bulkBillingActionApproval.create({
          data: {
            actionId: action.id,
            approverRole: role,
            approverActor: actor,
            decision,
            note: body.note ? String(body.note) : null,
            manifestHash: action.manifestHash,
            evidenceSignature,
          },
        });

        const allApprovals = await tx.bulkBillingActionApproval.findMany({
          where: { actionId: action.id },
          orderBy: { createdAt: "asc" },
        });

        let nextStatus = action.status;
        const approvedByRoles = allApprovals.filter((a) => a.decision === "APPROVE").map((a) => a.approverRole);
        const approveCount = approvedByRoles.length;

        if (decision === "REJECT") {
          nextStatus = "REJECTED";
        } else if (approveCount >= action.approvalsNeeded) {
          nextStatus = "APPROVED";
        } else {
          nextStatus = "PENDING_APPROVAL";
        }

        const updated = await tx.bulkBillingAction.update({
          where: { id: action.id },
          data: {
            approvedByRoles,
            status: nextStatus as any,
            approvedAt: nextStatus === "APPROVED" ? new Date() : action.approvedAt,
            rejectedAt: nextStatus === "REJECTED" ? new Date() : null,
            error: nextStatus === "REJECTED" ? (body.note ? String(body.note) : "rejected") : null,
          },
          include: { approvals: { orderBy: { createdAt: "asc" } } },
        });

        return { approval, updated };
      });

      await createExecutionEvidence({
        actionId: action.id,
        manifestHash: action.manifestHash,
        eventType: decision === "APPROVE" ? "billing.bulk_action.approval" : "billing.bulk_action.rejection",
        role,
        actor,
        payload: approvalPayload,
      });

      return NextResponse.json({ ok: true, action: result.updated, approval: result.approval });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json({ error: "approval already recorded for role" }, { status: 409 });
      }
      return NextResponse.json({ error: error?.message ?? "failed to record approval" }, { status: 500 });
    }
  }

  if (action.status !== "APPROVED") {
    return NextResponse.json({ error: "action must be APPROVED before execute" }, { status: 409 });
  }
  if (!canRequestBulkAction(role, payload.actionType)) {
    return unauthorized();
  }

  const lock = await prisma.bulkBillingAction.updateMany({
    where: { id: action.id, status: "APPROVED" },
    data: { status: "EXECUTING" },
  });
  if (lock.count === 0) {
    return NextResponse.json({ error: "action already executing or executed" }, { status: 409 });
  }

  try {
    const summary = await executeBulkAction(action, role, actor);
    const updated = await prisma.bulkBillingAction.update({
      where: { id: action.id },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        result: summary as any,
        error: null,
      },
      include: { approvals: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ ok: true, action: updated, summary });
  } catch (error: any) {
    const updated = await prisma.bulkBillingAction.update({
      where: { id: action.id },
      data: {
        status: "FAILED",
        error: error?.message ? String(error.message) : "execution_failed",
        result: { failedAt: new Date().toISOString() } as any,
      },
      include: { approvals: { orderBy: { createdAt: "asc" } } },
    });
    await createExecutionEvidence({
      actionId: action.id,
      manifestHash: action.manifestHash,
      eventType: "billing.bulk_action.failure",
      role,
      actor,
      payload: {
        actionType: payload.actionType,
        error: updated.error,
        failedAt: new Date().toISOString(),
      },
    }).catch(() => undefined);
    return NextResponse.json({ error: updated.error ?? "execution_failed", action: updated }, { status: 500 });
  }
}
