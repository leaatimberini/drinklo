import type { PrismaClient } from "./generated/prisma";
import { baDayKey } from "./activation-score";
import { hashEvidencePayload } from "./compliance-evidence";

type AnyPrisma = PrismaClient | any;

export type CustomerHealthState = "HEALTHY" | "WATCH" | "AT_RISK";

export type CustomerHealthInput = {
  installationId: string;
  instanceId: string;
  clientName?: string | null;
  domain?: string | null;
  businessType?: string | null;
  planName?: string | null;
  billingStatus?: string | null;
  monthlyOrders?: number | null;
  posActions30d?: number | null;
  campaignActions30d?: number | null;
  logins30d?: number | null;
  activeIncidents?: number | null;
  incidents30d?: number | null;
  jobFailures7d?: number | null;
  alerts7d?: number | null;
  healthStatus?: string | null;
  sloP95Ms?: number | null;
  sloErrorRate?: number | null;
  openInvoicePastDueDays?: number | null;
  softLimited?: boolean | null;
  hardLimited?: boolean | null;
  warningCount?: number | null;
  npsAvg?: number | null; // 0..10 response average
  csatAvg?: number | null; // 1..5 average
  openFeedbackIssues?: number | null;
  integrationConnectorsTotal?: number | null;
  integrationConnectorsActive?: number | null;
  integrationFailures24h?: number | null;
  integrationDlqOpen?: number | null;
  csmUserId?: string | null;
};

export type CustomerHealthScoreItem = {
  installationId: string;
  instanceId: string;
  clientName?: string | null;
  domain?: string | null;
  businessType?: string | null;
  planName?: string | null;
  score: number;
  state: CustomerHealthState;
  components: {
    usage: number;
    reliability: number;
    billing: number;
    feedback: number;
    integrations: number;
  };
  raw: {
    monthlyOrders: number;
    posActions30d: number;
    campaignActions30d: number;
    logins30d: number;
    activeIncidents: number;
    incidents30d: number;
    jobFailures7d: number;
    alerts7d: number;
    openInvoicePastDueDays: number;
    openFeedbackIssues: number;
    integrationConnectorsTotal: number;
    integrationConnectorsActive: number;
    integrationFailures24h: number;
    integrationDlqOpen: number;
  };
  reasons: string[];
  playbooksSuggested: string[];
  automation: {
    eligibleAtRisk: boolean;
    csmUserId?: string | null;
    csmEmail?: string | null;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function looksHealthy(status?: string | null) {
  const v = String(status ?? "").toLowerCase();
  return ["healthy", "ok", "operational"].includes(v);
}

function maybeEmail(value?: string | null) {
  const v = String(value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

function mapNpsResponseAvgToScore(npsAvg: number | null | undefined) {
  if (npsAvg == null || !Number.isFinite(Number(npsAvg))) return 8; // neutral if no survey yet
  const v = clamp(Number(npsAvg), 0, 10);
  return Number((v * 0.9).toFixed(1)); // 0..9 of 15-budget subcomponent share
}

function mapCsatAvgToScore(csatAvg: number | null | undefined) {
  if (csatAvg == null || !Number.isFinite(Number(csatAvg))) return 5; // neutral if no survey yet
  const v = clamp(Number(csatAvg), 1, 5);
  return Number((((v - 1) / 4) * 6).toFixed(1)); // 0..6
}

export function scoreCustomerHealth(input: CustomerHealthInput): CustomerHealthScoreItem {
  const monthlyOrders = Math.max(0, asNum(input.monthlyOrders));
  const posActions30d = Math.max(0, asNum(input.posActions30d));
  const campaignActions30d = Math.max(0, asNum(input.campaignActions30d));
  const logins30d = Math.max(0, asNum(input.logins30d));
  const activeIncidents = Math.max(0, asNum(input.activeIncidents));
  const incidents30d = Math.max(0, asNum(input.incidents30d));
  const jobFailures7d = Math.max(0, asNum(input.jobFailures7d));
  const alerts7d = Math.max(0, asNum(input.alerts7d));
  const openInvoicePastDueDays = Math.max(0, asNum(input.openInvoicePastDueDays));
  const warningCount = Math.max(0, asNum(input.warningCount));
  const openFeedbackIssues = Math.max(0, asNum(input.openFeedbackIssues));
  const integrationConnectorsTotal = Math.max(0, asNum(input.integrationConnectorsTotal));
  const integrationConnectorsActive = Math.max(0, asNum(input.integrationConnectorsActive));
  const integrationFailures24h = Math.max(0, asNum(input.integrationFailures24h));
  const integrationDlqOpen = Math.max(0, asNum(input.integrationDlqOpen));
  const hardLimited = Boolean(input.hardLimited);
  const softLimited = Boolean(input.softLimited);
  const billingStatus = String(input.billingStatus ?? "ACTIVE").toUpperCase();

  const usageOrders = clamp(monthlyOrders >= 1 ? 15 : monthlyOrders * 5, 0, 15);
  const usagePos = clamp(posActions30d >= 3 ? 8 : posActions30d * 2, 0, 8);
  const usageCampaigns = clamp(campaignActions30d >= 2 ? 6 : campaignActions30d * 3, 0, 6);
  const usageLogins = clamp(logins30d >= 6 ? 6 : logins30d, 0, 6);
  const usage = Number((usageOrders + usagePos + usageCampaigns + usageLogins).toFixed(1)); // /35

  let reliability = 20;
  if (!looksHealthy(input.healthStatus)) reliability -= 5;
  if ((input.sloP95Ms ?? 0) > 1500) reliability -= 4;
  else if ((input.sloP95Ms ?? 0) > 800) reliability -= 2;
  if ((input.sloErrorRate ?? 0) > 0.05) reliability -= 4;
  else if ((input.sloErrorRate ?? 0) > 0.02) reliability -= 2;
  reliability -= Math.min(8, activeIncidents * 4 + Math.max(0, incidents30d - activeIncidents));
  reliability -= Math.min(6, jobFailures7d);
  reliability -= Math.min(4, alerts7d);
  reliability = Number(clamp(reliability, 0, 20).toFixed(1));

  let billing = 20;
  if (billingStatus === "PAST_DUE") billing = 12;
  else if (billingStatus === "SUSPENDED") billing = 6;
  else if (billingStatus === "CANCELED" || billingStatus === "CANCELLED") billing = 2;
  billing -= Math.min(10, Math.floor(openInvoicePastDueDays / 3));
  billing -= Math.min(4, warningCount);
  if (softLimited) billing = Math.min(billing, 8);
  if (hardLimited) billing = Math.min(billing, 2);
  billing = Number(clamp(billing, 0, 20).toFixed(1));

  let feedback = mapNpsResponseAvgToScore(input.npsAvg) + mapCsatAvgToScore(input.csatAvg); // /15
  feedback -= Math.min(6, openFeedbackIssues * 2);
  feedback = Number(clamp(feedback, 0, 15).toFixed(1));

  let integrations = 10;
  if (integrationConnectorsTotal > 0) {
    const activeRatio = integrationConnectorsActive / Math.max(1, integrationConnectorsTotal);
    integrations = Number((activeRatio * 8 + 2).toFixed(1));
  }
  integrations -= Math.min(4, integrationFailures24h);
  integrations -= Math.min(4, Math.ceil(integrationDlqOpen / 5));
  integrations = Number(clamp(integrations, 0, 10).toFixed(1));

  const score = Number(clamp(Math.round(usage + reliability + billing + feedback + integrations), 0, 100));
  const state: CustomerHealthState = score >= 75 ? "HEALTHY" : score >= 50 ? "WATCH" : "AT_RISK";

  const reasons: string[] = [];
  if (usage < 16) reasons.push("Uso bajo o inconsistente (órdenes/POS/campañas/logins).");
  if (reliability < 12) reasons.push("Señales de confiabilidad degradada (incidentes/errores/jobs).");
  if (billing < 12) reasons.push("Riesgo de pago / mora / límites comerciales.");
  if (feedback < 8) reasons.push("Feedback débil (NPS/CSAT) o issues abiertos.");
  if (integrations < 6) reasons.push("Integraciones caídas o con DLQ/fallos.");
  if (state === "AT_RISK" && reasons.length === 0) reasons.push("Riesgo compuesto por múltiples señales.");

  const playbooksSuggested = Array.from(
    new Set(
      [
        usage < 16 ? "CSM: sesión de activación de operación (catálogo/POS/primeras campañas)" : null,
        reliability < 12 ? "Ops: revisión de errores recurrentes, colas e incidentes por instancia" : null,
        billing < 12 ? "Billing: outreach preventivo por mora / medio de pago / downgrade controlado" : null,
        feedback < 8 ? "Customer Success: follow-up de NPS/CSAT bajo con plan de acción" : null,
        integrations < 6 ? "Integrations: health check + reconfiguración de conectores críticos" : null,
      ].filter(Boolean) as string[],
    ),
  );

  const csmEmail = maybeEmail(input.csmUserId) ?? maybeEmail(process.env.CUSTOMER_HEALTH_DEFAULT_CSM_EMAIL);

  return {
    installationId: input.installationId,
    instanceId: input.instanceId,
    clientName: input.clientName ?? null,
    domain: input.domain ?? null,
    businessType: input.businessType ?? null,
    planName: input.planName ?? null,
    score,
    state,
    components: { usage, reliability, billing, feedback, integrations },
    raw: {
      monthlyOrders,
      posActions30d,
      campaignActions30d,
      logins30d,
      activeIncidents,
      incidents30d,
      jobFailures7d,
      alerts7d,
      openInvoicePastDueDays,
      openFeedbackIssues,
      integrationConnectorsTotal,
      integrationConnectorsActive,
      integrationFailures24h,
      integrationDlqOpen,
    },
    reasons,
    playbooksSuggested,
    automation: {
      eligibleAtRisk: state === "AT_RISK",
      csmUserId: input.csmUserId ?? null,
      csmEmail,
    },
  };
}

export async function loadCustomerHealthDashboard(
  prisma: AnyPrisma,
  options?: { take?: number; instanceId?: string | null; now?: Date },
) {
  const now = options?.now ?? new Date();
  const take = Math.min(500, Math.max(1, Number(options?.take ?? 200)));
  const instanceIdFilter = String(options?.instanceId ?? "").trim();
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const installations = await prisma.installation.findMany({
    where: instanceIdFilter ? { instanceId: { contains: instanceIdFilter } } : undefined,
    select: {
      id: true,
      instanceId: true,
      clientName: true,
      domain: true,
      healthStatus: true,
      sloP95Ms: true,
      sloErrorRate: true,
      createdAt: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take,
  });
  const installationIds = (installations as any[]).map((i) => i.id);
  const instanceIds = (installations as any[]).map((i) => i.instanceId);

  const [
    billingAccounts,
    invoices,
    featureUsage,
    jobFailures,
    alerts,
    statusIncidents,
    integrationReports,
    feedbackResponses,
    feedbackIssues,
    crmDeals,
  ] = await Promise.all([
    instanceIds.length
      ? prisma.billingAccount.findMany({
          where: { instanceId: { in: instanceIds } },
          include: { plan: true },
        })
      : Promise.resolve([]),
    instanceIds.length
      ? prisma.billingInvoice.findMany({
          where: {
            account: { instanceId: { in: instanceIds } },
            status: "OPEN",
          },
          orderBy: { dueAt: "asc" },
          take: 5000,
          include: { account: { select: { id: true, instanceId: true } } },
        })
      : Promise.resolve([]),
    instanceIds.length
      ? prisma.featureUsageSample.findMany({
          where: { instanceId: { in: instanceIds }, capturedAt: { gte: start30d } },
          take: 50000,
        })
      : Promise.resolve([]),
    installationIds.length
      ? prisma.jobFailure.findMany({
          where: { installationId: { in: installationIds }, createdAt: { gte: start7d } },
          take: 20000,
        })
      : Promise.resolve([]),
    installationIds.length
      ? prisma.alert.findMany({
          where: { installationId: { in: installationIds }, createdAt: { gte: start7d } },
          take: 20000,
        })
      : Promise.resolve([]),
    installationIds.length
      ? prisma.statusPageIncident.findMany({
          where: {
            installationId: { in: installationIds },
            startedAt: { gte: start30d },
          },
          take: 5000,
        })
      : Promise.resolve([]),
    instanceIds.length
      ? prisma.integrationBuilderReport.findMany({
          where: { instanceId: { in: instanceIds }, capturedAt: { gte: start30d } },
          orderBy: { capturedAt: "desc" },
          take: 10000,
        })
      : Promise.resolve([]),
    installationIds.length
      ? prisma.feedbackSurveyResponse.findMany({
          where: {
            submittedAt: { gte: start90d },
            send: { installationId: { in: installationIds } },
          },
          include: {
            send: {
              select: {
                installationId: true,
                instanceId: true,
                campaign: { select: { type: true } },
              },
            },
          },
          take: 10000,
        })
      : Promise.resolve([]),
    installationIds.length
      ? prisma.feedbackIssue.findMany({
          where: { installationId: { in: installationIds }, status: { in: ["OPEN", "TRIAGED"] } },
          take: 5000,
        })
      : Promise.resolve([]),
    installationIds.length
      ? prisma.crmDeal.findMany({
          where: { installationId: { in: installationIds } },
          orderBy: { updatedAt: "desc" },
          take: 10000,
        })
      : Promise.resolve([]),
  ]);

  const billingByInstance = new Map<string, any>();
  for (const account of billingAccounts as any[]) billingByInstance.set(account.instanceId, account);

  const openPastDueByInstance = new Map<string, number>();
  for (const inv of invoices as any[]) {
    const iid = inv.account?.instanceId;
    if (!iid) continue;
    const days = Math.max(0, Math.floor((now.getTime() - new Date(inv.dueAt).getTime()) / (24 * 60 * 60 * 1000)));
    if (days <= 0) continue;
    const prev = openPastDueByInstance.get(iid) ?? 0;
    openPastDueByInstance.set(iid, Math.max(prev, days));
  }

  const usageByInstance = new Map<string, { pos: number; campaigns: number; logins: number }>();
  for (const row of featureUsage as any[]) {
    const iid = String(row.instanceId);
    const bucket = usageByInstance.get(iid) ?? { pos: 0, campaigns: 0, logins: 0 };
    const feature = String(row.feature ?? "").toLowerCase();
    const action = String(row.action ?? "").toLowerCase();
    const count = Math.max(0, Number(row.count ?? 0));
    if (feature.includes("pos")) bucket.pos += count;
    if (feature.includes("campaign")) bucket.campaigns += count;
    if (feature.includes("auth") || action.includes("login")) bucket.logins += count;
    usageByInstance.set(iid, bucket);
  }

  const jobFailuresByInstallation = new Map<string, number>();
  for (const row of jobFailures as any[]) {
    const key = String(row.installationId);
    jobFailuresByInstallation.set(key, (jobFailuresByInstallation.get(key) ?? 0) + 1);
  }

  const alertsByInstallation = new Map<string, number>();
  for (const row of alerts as any[]) {
    const key = String(row.installationId);
    const lvl = String(row.level ?? "").toLowerCase();
    const weight = lvl === "danger" || lvl === "critical" ? 2 : 1;
    alertsByInstallation.set(key, (alertsByInstallation.get(key) ?? 0) + weight);
  }

  const incidentsByInstallation = new Map<string, { active: number; total: number }>();
  for (const row of statusIncidents as any[]) {
    if (!row.installationId) continue;
    const key = String(row.installationId);
    const bucket = incidentsByInstallation.get(key) ?? { active: 0, total: 0 };
    bucket.total += 1;
    if (!row.isClosed) bucket.active += 1;
    incidentsByInstallation.set(key, bucket);
  }

  const latestIntegrationByInstance = new Map<string, any>();
  for (const row of integrationReports as any[]) {
    if (!latestIntegrationByInstance.has(row.instanceId)) latestIntegrationByInstance.set(row.instanceId, row);
  }

  const feedbackByInstallation = new Map<string, { npsScores: number[]; csatScores: number[] }>();
  for (const row of feedbackResponses as any[]) {
    const iid = row.send?.installationId ? String(row.send.installationId) : null;
    if (!iid) continue;
    const bucket = feedbackByInstallation.get(iid) ?? { npsScores: [], csatScores: [] };
    const type = String(row.surveyType ?? row.send?.campaign?.type ?? "").toUpperCase();
    const score = Number(row.score ?? 0);
    if (type === "CSAT") bucket.csatScores.push(score);
    else bucket.npsScores.push(score);
    feedbackByInstallation.set(iid, bucket);
  }

  const feedbackIssuesByInstallation = new Map<string, number>();
  for (const row of feedbackIssues as any[]) {
    if (!row.installationId) continue;
    const key = String(row.installationId);
    feedbackIssuesByInstallation.set(key, (feedbackIssuesByInstallation.get(key) ?? 0) + 1);
  }

  const csmByInstallation = new Map<string, string>();
  for (const row of crmDeals as any[]) {
    if (!row.installationId) continue;
    const key = String(row.installationId);
    if (!csmByInstallation.has(key) && row.ownerUserId) csmByInstallation.set(key, String(row.ownerUserId));
  }

  const items: CustomerHealthScoreItem[] = (installations as any[]).map((inst) => {
    const account = billingByInstance.get(inst.instanceId);
    const usage = usageByInstance.get(inst.instanceId) ?? { pos: 0, campaigns: 0, logins: 0 };
    const incident = incidentsByInstallation.get(inst.id) ?? { active: 0, total: 0 };
    const integ = latestIntegrationByInstance.get(inst.instanceId);
    const fb = feedbackByInstallation.get(inst.id) ?? { npsScores: [], csatScores: [] };
    const npsAvg = fb.npsScores.length ? fb.npsScores.reduce((a, b) => a + b, 0) / fb.npsScores.length : null;
    const csatAvg = fb.csatScores.length ? fb.csatScores.reduce((a, b) => a + b, 0) / fb.csatScores.length : null;

    return scoreCustomerHealth({
      installationId: inst.id,
      instanceId: inst.instanceId,
      clientName: inst.clientName ?? null,
      domain: inst.domain ?? null,
      businessType: null,
      planName: account?.plan?.name ?? null,
      billingStatus: account?.status ?? null,
      monthlyOrders: account?.monthlyOrders ?? 0,
      posActions30d: usage.pos,
      campaignActions30d: usage.campaigns,
      logins30d: usage.logins,
      activeIncidents: incident.active,
      incidents30d: incident.total,
      jobFailures7d: jobFailuresByInstallation.get(inst.id) ?? 0,
      alerts7d: alertsByInstallation.get(inst.id) ?? 0,
      healthStatus: inst.healthStatus ?? null,
      sloP95Ms: inst.sloP95Ms ?? null,
      sloErrorRate: inst.sloErrorRate ?? null,
      openInvoicePastDueDays: openPastDueByInstance.get(inst.instanceId) ?? 0,
      softLimited: Boolean(account?.softLimitedAt),
      hardLimited: Boolean(account?.hardLimitedAt),
      warningCount: account?.warningCount ?? 0,
      npsAvg,
      csatAvg,
      openFeedbackIssues: feedbackIssuesByInstallation.get(inst.id) ?? 0,
      integrationConnectorsTotal: integ?.connectorsTotal ?? 0,
      integrationConnectorsActive: integ?.connectorsActive ?? 0,
      integrationFailures24h: integ?.deliveriesFailed24h ?? 0,
      integrationDlqOpen: integ?.dlqOpen ?? 0,
      csmUserId: csmByInstallation.get(inst.id) ?? null,
    });
  });

  const summary = {
    total: items.length,
    avgScore: items.length ? Number((items.reduce((s, i) => s + i.score, 0) / items.length).toFixed(1)) : 0,
    byState: {
      healthy: items.filter((i) => i.state === "HEALTHY").length,
      watch: items.filter((i) => i.state === "WATCH").length,
      atRisk: items.filter((i) => i.state === "AT_RISK").length,
    },
  };

  const alertsOut = items
    .filter((i) => i.state !== "HEALTHY")
    .flatMap((i) =>
      i.reasons.slice(0, 3).map((reason) => ({
        installationId: i.installationId,
        instanceId: i.instanceId,
        clientName: i.clientName,
        level: i.state === "AT_RISK" ? "danger" : "warning",
        score: i.score,
        state: i.state,
        reason,
      })),
    )
    .sort((a, b) => {
      const lv = (x: string) => (x === "danger" ? 2 : 1);
      return lv(b.level) - lv(a.level) || a.score - b.score;
    });

  return {
    generatedAt: now.toISOString(),
    summary,
    alerts: alertsOut,
    items: items.sort((a, b) => a.score - b.score || a.instanceId.localeCompare(b.instanceId)),
  };
}

export async function runCustomerHealthAutomations(
  prisma: AnyPrisma,
  input?: { take?: number; instanceId?: string | null; actor?: string | null; now?: Date },
) {
  const actor = input?.actor ?? "cp:system";
  const now = input?.now ?? new Date();
  const dashboard = await loadCustomerHealthDashboard(prisma, input);
  const dayKey = baDayKey(now);

  let tasksCreated = 0;
  let alertsCreated = 0;
  let emailsQueued = 0;
  const results: Array<{ instanceId: string; taskCreated: boolean; alertCreated: boolean; csmEmail?: string | null }> = [];

  for (const item of dashboard.items) {
    if (item.state !== "AT_RISK") continue;
    if (!item.installationId) continue;

    const deal = await prisma.crmDeal.findFirst({
      where: { installationId: item.installationId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, ownerUserId: true, title: true, stage: true },
    }).catch(() => null);

    let taskCreated = false;
    if (deal?.id) {
      const dedupeTitle = `[customer-health:${dayKey}] At Risk follow-up for ${item.instanceId}`;
      const existingTask = await prisma.crmDealTask.findFirst({
        where: { dealId: deal.id, title: dedupeTitle },
      }).catch(() => null);
      if (!existingTask) {
        await prisma.crmDealTask.create({
          data: {
            dealId: deal.id,
            title: dedupeTitle,
            dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            assignedTo: deal.ownerUserId ?? null,
            createdBy: String(actor),
          },
        }).catch(() => null);
        taskCreated = true;
        tasksCreated += 1;
      }
    }

    const alertMessage = `Customer health ${item.state} (${item.score}) for ${item.instanceId}`;
    const existingAlert = await prisma.alert.findFirst({
      where: {
        installationId: item.installationId,
        level: item.state === "AT_RISK" ? "danger" : "warning",
        message: alertMessage,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }).catch(() => null);
    let alertCreated = false;
    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          installationId: item.installationId,
          level: "danger",
          message: alertMessage,
        },
      }).catch(() => null);
      alertCreated = true;
      alertsCreated += 1;
    }

    const csmEmail = maybeEmail(item.automation.csmEmail) ?? maybeEmail(deal?.ownerUserId ?? null);
    if (csmEmail) {
      const emailPayload = {
        kind: "customer_health_at_risk_email_mock",
        instanceId: item.instanceId,
        installationId: item.installationId,
        score: item.score,
        state: item.state,
        to: csmEmail,
        reasons: item.reasons,
        playbooksSuggested: item.playbooksSuggested,
        generatedAt: now.toISOString(),
      };
      const payloadHash = hashEvidencePayload(emailPayload);
      const sentToday = await prisma.complianceEvidence.findFirst({
        where: {
          installationId: item.installationId,
          evidenceType: "customer_health.csm_email_mock",
          payloadHash,
        },
      }).catch(() => null);
      if (!sentToday) {
        await prisma.complianceEvidence.create({
          data: {
            installationId: item.installationId,
            controlId: null,
            evidenceType: "customer_health.csm_email_mock",
            source: "control-plane",
            payload: emailPayload as any,
            payloadHash,
            sourceCapturedAt: now,
            capturedBy: String(actor),
            tags: ["customer-health", "csm", "email", "mock"],
          },
        }).catch(() => null);
        emailsQueued += 1;
      }
    }

    results.push({ instanceId: item.instanceId, taskCreated, alertCreated, csmEmail });
  }

  return {
    generatedAt: now.toISOString(),
    scanned: dashboard.items.length,
    atRisk: dashboard.items.filter((i) => i.state === "AT_RISK").length,
    tasksCreated,
    alertsCreated,
    emailsQueued,
    results,
  };
}

