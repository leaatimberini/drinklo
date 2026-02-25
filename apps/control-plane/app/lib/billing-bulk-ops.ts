import { hashEvidencePayload } from "./compliance-evidence";
import { signPayload } from "./signing";
import { getTokenForRole, isRoleAllowed, type Role } from "./auth";
import type { NextRequest } from "next/server";

export type BulkActionKind = "SET_TIER" | "EXTEND_TRIAL" | "FRAUD_PAUSE" | "FRAUD_CANCEL";

export type BulkActionPayload = {
  actionType: BulkActionKind;
  instanceIds?: string[];
  campaignId?: string | null;
  targetTier?: "C1" | "C2" | "C3" | null;
  trialExtensionDays?: number | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
};

export function getControlPlaneRoleFromRequest(req: NextRequest): Role | null {
  const role = req.cookies.get("cp_role")?.value as Role | undefined;
  const token = req.cookies.get("cp_token")?.value ?? "";
  if (!role || !token) return null;
  const expected = getTokenForRole(role);
  if (!expected || token !== expected) return null;
  return role;
}

export function getControlPlaneActor(req: NextRequest) {
  return (req.headers.get("x-cp-actor") ?? req.cookies.get("cp_actor")?.value ?? "").trim() || null;
}

export function canRequestBulkAction(role: Role, actionType: BulkActionKind) {
  if (actionType === "SET_TIER" || actionType === "EXTEND_TRIAL") {
    return isRoleAllowed(role, ["support", "ops", "admin"]);
  }
  if (actionType === "FRAUD_PAUSE" || actionType === "FRAUD_CANCEL") {
    return isRoleAllowed(role, ["ops", "admin"]);
  }
  return false;
}

export function normalizeInstanceIds(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v) => String(v ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeTier(value: unknown): "C1" | "C2" | "C3" | null {
  const tier = String(value ?? "")
    .trim()
    .toUpperCase();
  if (tier === "C1" || tier === "C2" || tier === "C3") return tier;
  return null;
}

export function validateBulkPayload(payload: BulkActionPayload) {
  const actionType = payload.actionType;
  const instanceIds = normalizeInstanceIds(payload.instanceIds);
  const campaignId = payload.campaignId ? String(payload.campaignId).trim() : null;
  const hasTargets = instanceIds.length > 0 || Boolean(campaignId);
  if (!hasTargets) {
    throw new Error("At least one target is required (instanceIds or campaignId)");
  }
  if (actionType === "SET_TIER" && !payload.targetTier) {
    throw new Error("targetTier is required for SET_TIER");
  }
  if (actionType === "EXTEND_TRIAL") {
    const days = Number(payload.trialExtensionDays ?? 0);
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      throw new Error("trialExtensionDays must be between 1 and 90");
    }
  }
  return {
    ...payload,
    instanceIds,
    campaignId,
    targetTier: normalizeTier(payload.targetTier) ?? null,
    trialExtensionDays: payload.trialExtensionDays == null ? null : Number(payload.trialExtensionDays),
    reason: payload.reason ? String(payload.reason) : null,
    metadata: payload.metadata ?? null,
  };
}

export function buildBulkActionManifest(input: {
  actionType: BulkActionKind;
  instanceIds: string[];
  campaignId?: string | null;
  targetTier?: string | null;
  trialExtensionDays?: number | null;
  reason?: string | null;
  requestedByRole: string;
  requestedByActor?: string | null;
  approvalsNeeded: number;
  requiresTwoPersonApproval: boolean;
}) {
  const manifest = {
    actionType: input.actionType,
    instanceIds: [...(input.instanceIds ?? [])].sort(),
    campaignId: input.campaignId ?? null,
    targetTier: input.targetTier ?? null,
    trialExtensionDays: input.trialExtensionDays ?? null,
    reason: input.reason ?? null,
    requestedByRole: input.requestedByRole,
    requestedByActor: input.requestedByActor ?? null,
    approvalsNeeded: input.approvalsNeeded,
    requiresTwoPersonApproval: input.requiresTwoPersonApproval,
  };
  return manifest;
}

export function uniqueSorted(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).map((v) => String(v ?? "").trim()).filter(Boolean))).sort();
}

export function safeJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function signBulkActionManifest(manifest: unknown) {
  const secret =
    process.env.CONTROL_PLANE_BULK_OPS_SIGNING_SECRET ??
    process.env.SOC2_EVIDENCE_SIGNING_SECRET ??
    process.env.CONTROL_PLANE_ADMIN_TOKEN ??
    "cp-bulk-ops-dev";
  const manifestHash = hashEvidencePayload(manifest);
  const evidenceSignature = signPayload({ manifestHash, manifest }, secret);
  return { manifestHash, evidenceSignature };
}

export function resolveApprovalsNeeded(input: {
  requireTwoPersonApproval?: boolean;
  targetCount: number;
}) {
  const envDefault = (process.env.CONTROL_PLANE_BULK_OPS_REQUIRE_TWO_PERSON ?? "false").toLowerCase() === "true";
  const threshold = Number(process.env.CONTROL_PLANE_BULK_OPS_TWO_PERSON_THRESHOLD ?? 25);
  const needsTwo = Boolean(input.requireTwoPersonApproval || envDefault || (Number.isFinite(threshold) && input.targetCount >= threshold));
  return needsTwo ? 2 : 1;
}

export function canApproveBulkAction(params: {
  role: Role;
  actionType: BulkActionKind;
  requestedByRole: string;
  requestedByActor?: string | null;
  approverActor?: string | null;
  requiresTwoPersonApproval: boolean;
  existingApproverRoles: string[];
}) {
  if (!canRequestBulkAction(params.role, params.actionType)) {
    return { ok: false as const, reason: "role_not_allowed" };
  }
  if (params.existingApproverRoles.includes(params.role)) {
    return { ok: false as const, reason: "role_already_approved" };
  }
  if (params.requiresTwoPersonApproval) {
    if (params.role === params.requestedByRole) {
      return { ok: false as const, reason: "second_approver_must_be_different_role" };
    }
    if (params.requestedByActor && params.approverActor && params.requestedByActor === params.approverActor) {
      return { ok: false as const, reason: "second_approver_must_be_different_actor" };
    }
  }
  return { ok: true as const };
}
