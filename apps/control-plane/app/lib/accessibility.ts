import { prisma } from "./prisma";

export type AccessibilityPageInput = {
  key: string;
  url: string;
  criticalViolations: number;
  seriousViolations: number;
  totalViolations: number;
};

export type AccessibilityIngestInput = {
  instanceId: string;
  version: string;
  score: number;
  criticalViolations?: number;
  seriousViolations?: number;
  totalViolations?: number;
  pages?: AccessibilityPageInput[];
  measuredAt?: string;
};

export function normalizeAccessibilityPayload(input: AccessibilityIngestInput) {
  const instanceId = String(input.instanceId ?? "").trim();
  const version = String(input.version ?? "").trim() || "unknown";
  const score = Number(input.score);
  if (!instanceId || !Number.isFinite(score)) {
    throw new Error("invalid payload");
  }

  const pages = Array.isArray(input.pages)
    ? input.pages
        .map((page) => ({
          key: String(page.key ?? "").trim(),
          url: String(page.url ?? "").trim(),
          criticalViolations: Math.max(0, Number(page.criticalViolations ?? 0)),
          seriousViolations: Math.max(0, Number(page.seriousViolations ?? 0)),
          totalViolations: Math.max(0, Number(page.totalViolations ?? 0)),
        }))
        .filter((page) => page.key && page.url)
    : [];

  const measuredAt = input.measuredAt ? new Date(input.measuredAt) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    throw new Error("invalid measuredAt");
  }

  const criticalViolations =
    input.criticalViolations != null
      ? Math.max(0, Number(input.criticalViolations))
      : pages.reduce((sum, page) => sum + page.criticalViolations, 0);
  const seriousViolations =
    input.seriousViolations != null
      ? Math.max(0, Number(input.seriousViolations))
      : pages.reduce((sum, page) => sum + page.seriousViolations, 0);
  const totalViolations =
    input.totalViolations != null
      ? Math.max(0, Number(input.totalViolations))
      : pages.reduce((sum, page) => sum + page.totalViolations, 0);

  return {
    instanceId,
    version,
    score: Math.max(0, Math.min(100, score)),
    criticalViolations,
    seriousViolations,
    totalViolations,
    pages,
    measuredAt,
  };
}

export async function listAccessibilityReports(limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(1, limit), 500) : 100;
  return prisma.accessibilityReport.findMany({
    take: safeLimit,
    orderBy: { measuredAt: "desc" },
    include: {
      installation: {
        select: {
          instanceId: true,
          domain: true,
          clientName: true,
        },
      },
    },
  });
}
