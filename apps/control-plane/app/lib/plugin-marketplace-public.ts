import type { ReviewReport } from "./plugin-review";

export type CompatibilityCell = {
  platformVersion: string;
  status: "supported" | "warning" | "unsupported";
  notes?: string;
};

export type SubmissionLike = {
  pluginName: string;
  version: string;
  channel: string;
  compatibility?: string | null;
  compatibilityMatrix?: any;
  changelog?: string | null;
  signature: string;
  requestedPermissions: string[];
  dependencies: string[];
  publisher?: { verificationStatus?: string | null } | null;
  publisherId?: string | null;
  id?: string;
  reviewReport?: ReviewReport | null;
};

export type InstallRequestLike = {
  id: string;
  instanceId: string;
  pluginName: string;
  version?: string | null;
  action: string;
};

export function normalizeCompatibilityMatrix(input: any): CompatibilityCell[] {
  if (!Array.isArray(input)) return [];
  const rows = input
    .map((row) => ({
      platformVersion: String(row?.platformVersion ?? "").trim(),
      status: String(row?.status ?? "unsupported").toLowerCase(),
      notes: row?.notes ? String(row.notes) : undefined,
    }))
    .filter((row) => row.platformVersion)
    .map((row) => ({
      platformVersion: row.platformVersion,
      status:
        row.status === "supported" || row.status === "warning" || row.status === "unsupported"
          ? (row.status as CompatibilityCell["status"])
          : "unsupported",
      notes: row.notes,
    }));

  const unique = new Map<string, CompatibilityCell>();
  for (const row of rows) unique.set(row.platformVersion, row);
  return Array.from(unique.values()).sort((a, b) => a.platformVersion.localeCompare(b.platformVersion));
}

export function computeCertification(reviewReport: ReviewReport | null | undefined, channel: string, publisherVerified: boolean) {
  const policyPassed = reviewReport?.policyChecks?.status === "pass";
  const reviewDecisionApproved = reviewReport?.decision === "APPROVE";
  const staticPassed = reviewReport?.staticAnalysis?.status === "pass";
  const sandboxPassed =
    reviewReport?.sandboxE2E?.status === "pass" || reviewReport?.sandboxTest?.status === "pass";
  const sastPassed = reviewReport?.securityScan?.sast?.status === "pass";
  const dependencyPassed =
    reviewReport?.securityScan?.dependencyScan?.status === "pass" || reviewReport?.securityScan?.trivy?.status === "pass";
  const stableChannel = String(channel ?? "").toLowerCase() === "stable";
  const required = {
    policyPassed,
    reviewDecisionApproved,
    staticPassed,
    sandboxPassed,
    sastPassed,
    dependencyPassed,
    stableChannel,
    publisherVerified,
  };
  const certified = Object.values(required).every(Boolean);
  return {
    certified,
    report: {
      required,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function ensureSubmissionCanBeApproved(reviewReport: ReviewReport | null | undefined) {
  if (!reviewReport) {
    return { ok: false, reason: "missing automated review report" };
  }
  if (reviewReport.policyChecks?.status !== "pass") {
    return { ok: false, reason: "mandatory policy checks failed" };
  }
  if (reviewReport.decision !== "APPROVE") {
    return { ok: false, reason: "automated review decision is not APPROVE" };
  }
  if (reviewReport.securityScan?.sast?.status !== "pass") {
    return { ok: false, reason: "SAST must pass" };
  }
  const depStatus = reviewReport.securityScan?.dependencyScan?.status ?? reviewReport.securityScan?.trivy?.status;
  if (depStatus !== "pass") {
    return { ok: false, reason: "dependency scan must pass" };
  }
  const sandboxStatus = reviewReport.sandboxE2E?.status ?? reviewReport.sandboxTest?.status;
  if (sandboxStatus !== "pass") {
    return { ok: false, reason: "sandbox e2e must pass" };
  }
  return { ok: true as const };
}

export function buildReleaseDataFromSubmission(submission: SubmissionLike) {
  const reviewReport = (submission.reviewReport ?? null) as ReviewReport | null;
  const approval = ensureSubmissionCanBeApproved(reviewReport);
  if (!approval.ok) {
    throw new Error(approval.reason);
  }
  const compatibilityMatrix = normalizeCompatibilityMatrix(submission.compatibilityMatrix);
  const certification = computeCertification(
    reviewReport,
    submission.channel,
    submission.publisher?.verificationStatus === "VERIFIED",
  );

  return {
    publisherId: submission.publisherId ?? null,
    sourceSubmissionId: submission.id ?? null,
    name: submission.pluginName,
    version: submission.version,
    channel: submission.channel,
    compatibility: submission.compatibility ?? null,
    compatibilityMatrix: compatibilityMatrix.length > 0 ? compatibilityMatrix : undefined,
    changelog: submission.changelog ?? null,
    signature: submission.signature,
    permissions: submission.requestedPermissions,
    dependencies: submission.dependencies,
    reviewStatus: "approved",
    certified: certification.certified,
    certifiedAt: certification.certified ? new Date() : undefined,
    certificationReport: certification.report,
  };
}

export function buildInstallJobFromRequest(input: {
  installationId: string;
  request: InstallRequestLike;
  compatible?: boolean;
}) {
  if (input.compatible === false) {
    throw new Error("plugin version is not compatible with installation");
  }
  return {
    installationId: input.installationId,
    instanceId: input.request.instanceId,
    pluginName: input.request.pluginName,
    version: input.request.version ?? undefined,
    action: input.request.action,
    status: "pending" as const,
  };
}

export function isInstallationVersionCompatible(
  installationVersion: string | null | undefined,
  compatibility: string | null | undefined,
  compatibilityMatrix: any,
) {
  if (!installationVersion) return true;
  const matrix = normalizeCompatibilityMatrix(compatibilityMatrix);
  if (matrix.length > 0) {
    const row = matrix.find((item) => item.platformVersion === installationVersion);
    if (row) return row.status !== "unsupported";
  }
  const range = String(compatibility ?? "").trim();
  if (!range || range === "*" || range.toLowerCase() === "any") return true;
  return range
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((token) => installationVersion.startsWith(token.replace(/\.x$/i, ".")) || installationVersion === token);
}

export function computeRatingSummary(reviews: Array<{ rating: number }>) {
  const count = reviews.length;
  const average = count === 0 ? 0 : Number((reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count).toFixed(2));
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: reviews.filter((r) => Number(r.rating) === rating).length,
  }));
  return { count, average, distribution };
}
