import { prisma } from "./prisma";

export type DastSeverity = "critical" | "high" | "medium" | "low" | "info";
export type DastStatus = "open" | "triaged" | "fixed";

export type IncomingDastFinding = {
  target: string;
  ruleId: string;
  title: string;
  severity: DastSeverity | string;
  route: string;
  evidence?: string | null;
  recommendation?: string | null;
  metadata?: Record<string, any>;
};

function normalizeSeverity(value: string): DastSeverity {
  const lower = String(value ?? "").toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "medium") return "medium";
  if (lower === "low") return "low";
  return "info";
}

export function computeSlaDueAt(severity: string, now: Date = new Date()) {
  const normalized = normalizeSeverity(severity);
  const days = normalized === "critical" ? 7 : normalized === "high" ? 14 : normalized === "medium" ? 30 : normalized === "low" ? 90 : 180;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function ingestDastFindings(input: {
  instanceId?: string | null;
  repo?: string | null;
  sha?: string | null;
  runId?: string | null;
  findings: IncomingDastFinding[];
  status?: string;
  summary?: Record<string, any>;
}) {
  const now = new Date();
  const instanceId = input.instanceId ? String(input.instanceId) : null;
  let installationId: string | null = null;

  if (instanceId) {
    const installation = await prisma.installation.findUnique({ where: { instanceId } });
    installationId = installation?.id ?? null;
  }

  const report = await prisma.securityReport.create({
    data: {
      installationId,
      instanceId,
      repo: input.repo ?? null,
      sha: input.sha ?? null,
      runId: input.runId ?? null,
      kind: "dast-zap",
      status: input.status ?? "completed",
      summary: input.summary ?? undefined,
    },
  });

  let created = 0;
  let updated = 0;

  for (const finding of input.findings) {
    const severity = normalizeSeverity(finding.severity);
    const route = String(finding.route ?? "").trim() || "/";
    const target = String(finding.target ?? "").trim();
    const zapRuleId = String(finding.ruleId ?? "").trim();
    const title = String(finding.title ?? "").trim();

    if (!target || !zapRuleId || !title) {
      continue;
    }

    const existing = await prisma.dastFinding.findFirst({
      where: {
        instanceId,
        target,
        zapRuleId,
        route,
      },
    });

    if (existing) {
      await prisma.dastFinding.update({
        where: { id: existing.id },
        data: {
          securityReportId: report.id,
          severity,
          title,
          evidence: finding.evidence ?? null,
          recommendation: finding.recommendation ?? null,
          metadata: finding.metadata ?? undefined,
          status: existing.status === "fixed" ? "open" : existing.status,
          lastSeenAt: now,
          slaDueAt: existing.slaDueAt ?? computeSlaDueAt(severity, now),
        },
      });
      updated += 1;
    } else {
      await prisma.dastFinding.create({
        data: {
          installationId,
          instanceId,
          securityReportId: report.id,
          target,
          zapRuleId,
          title,
          severity,
          route,
          evidence: finding.evidence ?? null,
          recommendation: finding.recommendation ?? null,
          status: "open",
          firstSeenAt: now,
          lastSeenAt: now,
          slaDueAt: computeSlaDueAt(severity, now),
          metadata: finding.metadata ?? undefined,
        },
      });
      created += 1;
    }
  }

  return { reportId: report.id, created, updated, total: input.findings.length };
}

export async function listDastFindings(filters?: { status?: string; severity?: string; limit?: number }) {
  return prisma.dastFinding.findMany({
    where: {
      status: filters?.status ?? undefined,
      severity: filters?.severity ?? undefined,
    },
    include: {
      installation: {
        select: {
          id: true,
          instanceId: true,
          domain: true,
        },
      },
    },
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: Math.min(1000, Math.max(1, Number(filters?.limit ?? 200))),
  });
}

export async function updateDastFindingStatus(id: string, status: DastStatus, note?: string | null) {
  const now = new Date();
  return prisma.dastFinding.update({
    where: { id },
    data: {
      status,
      triagedAt: status === "triaged" ? now : undefined,
      fixedAt: status === "fixed" ? now : undefined,
      metadata: note
        ? {
            statusNote: note,
          }
        : undefined,
    },
  });
}
