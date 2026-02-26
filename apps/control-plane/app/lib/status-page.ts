import crypto from "node:crypto";
import type { PrismaClient } from "./generated/prisma";
import { hashEvidencePayload } from "./compliance-evidence";

type AnyPrisma = PrismaClient | any;

export type PublicStatusLevel = "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE";

export function toPublicStatusLabel(level: PublicStatusLevel) {
  if (level === "DEGRADED") return "Degraded";
  if (level === "PARTIAL_OUTAGE") return "Partial Outage";
  if (level === "MAJOR_OUTAGE") return "Major Outage";
  return "Operational";
}

export function deriveFleetStatus(input: {
  healthyCount: number;
  totalCount: number;
  avgP95Ms: number | null;
  avgErrorRate: number | null;
  avgWebhookRetryRate: number | null;
  activePublicIncidents?: Array<{ impact: string }>;
}) {
  const total = Math.max(0, Number(input.totalCount ?? 0));
  const healthy = Math.max(0, Number(input.healthyCount ?? 0));
  const ratio = total > 0 ? healthy / total : 1;
  const p95 = input.avgP95Ms ?? null;
  const err = input.avgErrorRate ?? null;
  const wh = input.avgWebhookRetryRate ?? null;
  const impacts = (input.activePublicIncidents ?? []).map((i) => String(i.impact ?? "").toUpperCase());

  if (impacts.includes("MAJOR_OUTAGE")) return "MAJOR_OUTAGE" as const;
  if (impacts.includes("PARTIAL_OUTAGE")) return "PARTIAL_OUTAGE" as const;
  if (impacts.includes("DEGRADED")) return "DEGRADED" as const;

  if (ratio < 0.7) return "MAJOR_OUTAGE" as const;
  if (ratio < 0.9) return "PARTIAL_OUTAGE" as const;
  if ((p95 != null && p95 > 800) || (err != null && err > 0.03) || (wh != null && wh > 0.05)) return "DEGRADED" as const;
  return "OPERATIONAL" as const;
}

export async function loadStatusPagePublicSummary(prisma: AnyPrisma) {
  const [installations, incidents] = await Promise.all([
    prisma.installation.findMany({
      select: {
        id: true,
        instanceId: true,
        clientName: true,
        domain: true,
        healthStatus: true,
        searchOk: true,
        sloP95Ms: true,
        sloErrorRate: true,
        sloWebhookRetryRate: true,
        sloUpdatedAt: true,
        lastHeartbeatAt: true,
        lastSeenAt: true,
      },
      take: 5000,
    }),
    prisma.statusPageIncident.findMany({
      where: { isPublic: true },
      include: { updates: { where: { isPublic: true }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ isClosed: "asc" }, { startedAt: "desc" }],
      take: 100,
    }),
  ]);

  const activeIncidents = (incidents as any[]).filter((i) => !i.isClosed);
  const recentIncidents = (incidents as any[]).slice(0, 20);
  const totalCount = (installations as any[]).length;
  const healthyCount = (installations as any[]).filter((i) =>
    ["healthy", "ok", "operational"].includes(String(i.healthStatus ?? "").toLowerCase()),
  ).length;
  const avg = averageMetrics(installations as any[]);

  const overall = deriveFleetStatus({
    healthyCount,
    totalCount,
    avgP95Ms: avg.p95Ms,
    avgErrorRate: avg.errorRate,
    avgWebhookRetryRate: avg.webhookRetryRate,
    activePublicIncidents: activeIncidents,
  });

  const components = [
    {
      key: "fleet-api",
      name: "API Fleet",
      status: overall,
      uptimePct: totalCount > 0 ? Number(((healthyCount / totalCount) * 100).toFixed(2)) : 100,
      latencyP95Ms: avg.p95Ms,
      errorRate: avg.errorRate,
    },
    {
      key: "webhooks",
      name: "Webhooks",
      status: deriveFleetStatus({
        healthyCount,
        totalCount,
        avgP95Ms: null,
        avgErrorRate: avg.webhookRetryRate == null ? null : avg.webhookRetryRate * 100,
        avgWebhookRetryRate: avg.webhookRetryRate,
        activePublicIncidents: activeIncidents.filter((i) => /webhook/i.test(String(i.component ?? ""))),
      }),
      uptimePct: totalCount > 0 ? Number(((healthyCount / totalCount) * 100).toFixed(2)) : 100,
      latencyP95Ms: null,
      errorRate: avg.webhookRetryRate,
    },
    {
      key: "search",
      name: "Search / Catalog Reads",
      status:
        (installations as any[]).some((i) => i.searchOk === false)
          ? ("DEGRADED" as PublicStatusLevel)
          : ("OPERATIONAL" as PublicStatusLevel),
      uptimePct:
        totalCount > 0
          ? Number(
              (((installations as any[]).filter((i) => i.searchOk !== false).length / totalCount) * 100).toFixed(2),
            )
          : 100,
      latencyP95Ms: avg.p95Ms,
      errorRate: avg.errorRate,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: overall,
    statusLabel: toPublicStatusLabel(overall),
    metrics: {
      instancesTotal: totalCount,
      instancesHealthy: healthyCount,
      uptimePct: totalCount > 0 ? Number(((healthyCount / totalCount) * 100).toFixed(2)) : 100,
      avgP95Ms: avg.p95Ms,
      avgErrorRate: avg.errorRate,
      avgWebhookRetryRate: avg.webhookRetryRate,
    },
    components,
    activeIncidents: activeIncidents.map(serializeIncidentPublic),
    recentIncidents: recentIncidents.map(serializeIncidentPublic),
  };
}

export async function loadStatusPageAdminDashboard(prisma: AnyPrisma) {
  const [publicSummary, subscriptions, incidents] = await Promise.all([
    loadStatusPagePublicSummary(prisma),
    prisma.statusPageSubscription.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.statusPageIncident.findMany({
      include: { updates: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ isClosed: "asc" }, { startedAt: "desc" }],
      take: 200,
    }),
  ]);
  return {
    ...publicSummary,
    subscriptions,
    incidents,
  };
}

export async function createStatusIncident(
  prisma: AnyPrisma,
  input: {
    title: string;
    summary: string;
    impact: "DEGRADED" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE" | "MAINTENANCE";
    state?: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
    component?: string | null;
    installationId?: string | null;
    isPublic?: boolean;
    createdBy?: string | null;
  },
) {
  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  if (!title || !summary) throw new Error("title_and_summary_required");
  const slug = `${slugify(title)}-${Date.now().toString().slice(-6)}`;
  const incident = await prisma.statusPageIncident.create({
    data: {
      slug,
      title,
      summary,
      impact: normalizeImpact(input.impact),
      state: normalizeState(input.state ?? "INVESTIGATING"),
      component: input.component ? String(input.component) : null,
      installationId: input.installationId ? String(input.installationId) : null,
      isPublic: input.isPublic === true,
      publishedAt: input.isPublic ? new Date() : null,
      createdBy: input.createdBy ? String(input.createdBy) : null,
      updatedBy: input.createdBy ? String(input.createdBy) : null,
    },
  });
  await prisma.statusPageIncidentUpdate.create({
    data: {
      incidentId: incident.id,
      state: incident.state,
      message: `Incident created: ${summary}`,
      isPublic: incident.isPublic,
      publishedAt: incident.isPublic ? new Date() : null,
      createdBy: input.createdBy ? String(input.createdBy) : null,
    },
  });
  return incident;
}

export async function updateStatusIncident(
  prisma: AnyPrisma,
  input: {
    incidentId: string;
    actor?: string | null;
    patch: Partial<{
      title: string;
      summary: string;
      impact: string;
      state: string;
      component: string | null;
      isPublic: boolean;
    }>;
  },
) {
  const data: Record<string, any> = {};
  if (input.patch.title != null) data.title = String(input.patch.title).trim();
  if (input.patch.summary != null) data.summary = String(input.patch.summary).trim();
  if (input.patch.impact != null) data.impact = normalizeImpact(input.patch.impact as any);
  if (input.patch.state != null) data.state = normalizeState(input.patch.state as any);
  if (input.patch.component !== undefined) data.component = input.patch.component ? String(input.patch.component) : null;
  if (input.patch.isPublic !== undefined) {
    data.isPublic = Boolean(input.patch.isPublic);
    if (data.isPublic) data.publishedAt = new Date();
  }
  if (input.actor) data.updatedBy = String(input.actor);
  return prisma.statusPageIncident.update({
    where: { id: input.incidentId },
    data,
  });
}

export async function addStatusIncidentUpdate(
  prisma: AnyPrisma,
  input: {
    incidentId: string;
    message: string;
    state?: string | null;
    isPublic?: boolean;
    actor?: string | null;
  },
) {
  const incident = await prisma.statusPageIncident.findUnique({ where: { id: input.incidentId } });
  if (!incident) throw new Error("incident_not_found");
  const state = input.state ? normalizeState(input.state as any) : null;
  const isPublic = input.isPublic ?? incident.isPublic;
  const update = await prisma.statusPageIncidentUpdate.create({
    data: {
      incidentId: incident.id,
      message: String(input.message ?? "").trim(),
      state,
      isPublic,
      publishedAt: isPublic ? new Date() : null,
      createdBy: input.actor ? String(input.actor) : null,
    },
  });
  if (state) {
    await prisma.statusPageIncident.update({
      where: { id: incident.id },
      data: {
        state,
        updatedBy: input.actor ? String(input.actor) : null,
      },
    });
  }
  await notifyStatusSubscribers(prisma, {
    event: "incident_update",
    incidentId: incident.id,
    incidentSlug: incident.slug,
    message: update.message,
    isPublic,
  });
  return update;
}

export async function publishStatusIncident(prisma: AnyPrisma, input: { incidentId: string; actor?: string | null }) {
  const incident = await prisma.statusPageIncident.update({
    where: { id: input.incidentId },
    data: {
      isPublic: true,
      publishedAt: new Date(),
      updatedBy: input.actor ? String(input.actor) : null,
    },
  });
  await prisma.statusPageIncidentUpdate.updateMany({
    where: { incidentId: incident.id, isPublic: true, publishedAt: null },
    data: { publishedAt: new Date() },
  });
  await notifyStatusSubscribers(prisma, {
    event: "incident_published",
    incidentId: incident.id,
    incidentSlug: incident.slug,
    title: incident.title,
    impact: incident.impact,
  });
  return incident;
}

export async function closeStatusIncident(prisma: AnyPrisma, input: { incidentId: string; actor?: string | null; resolutionSummary?: string | null }) {
  const incident = await prisma.statusPageIncident.findUnique({
    where: { id: input.incidentId },
    include: { updates: { orderBy: { createdAt: "asc" } } },
  });
  if (!incident) throw new Error("incident_not_found");

  const now = new Date();
  const updated = await prisma.statusPageIncident.update({
    where: { id: incident.id },
    data: {
      state: "RESOLVED",
      isClosed: true,
      closedAt: now,
      endedAt: now,
      updatedBy: input.actor ? String(input.actor) : null,
      postmortemTitle: incident.postmortemTitle ?? `Postmortem: ${incident.title}`,
      postmortemBody:
        incident.postmortemBody ??
        defaultPostmortemTemplate({
          title: incident.title,
          impact: incident.impact,
          startedAt: incident.startedAt,
          endedAt: now,
          updates: incident.updates ?? [],
          resolutionSummary: input.resolutionSummary ?? null,
        }),
    },
  });

  const msg = input.resolutionSummary ? `Resolved: ${String(input.resolutionSummary).trim()}` : "Incident resolved";
  await prisma.statusPageIncidentUpdate.create({
    data: {
      incidentId: incident.id,
      state: "RESOLVED",
      message: msg,
      isPublic: incident.isPublic,
      publishedAt: incident.isPublic ? now : null,
      createdBy: input.actor ? String(input.actor) : null,
    },
  });
  await notifyStatusSubscribers(prisma, {
    event: "incident_resolved",
    incidentId: incident.id,
    incidentSlug: incident.slug,
    title: incident.title,
  });
  return updated;
}

export async function publishIncidentPostmortem(prisma: AnyPrisma, input: { incidentId: string; actor?: string | null }) {
  const incident = await prisma.statusPageIncident.findUnique({ where: { id: input.incidentId } });
  if (!incident) throw new Error("incident_not_found");
  if (!incident.isClosed) throw new Error("incident_not_closed");
  const now = new Date();
  const updated = await prisma.statusPageIncident.update({
    where: { id: incident.id },
    data: {
      isPublic: true,
      publishedAt: incident.publishedAt ?? now,
      postmortemPublishedAt: now,
      updatedBy: input.actor ? String(input.actor) : null,
    },
  });
  await prisma.statusPageIncidentUpdate.create({
    data: {
      incidentId: incident.id,
      message: `Postmortem published`,
      isPublic: true,
      isPostmortem: true,
      publishedAt: now,
      createdBy: input.actor ? String(input.actor) : null,
    },
  });
  return updated;
}

export async function subscribeStatusPage(
  prisma: AnyPrisma,
  input: { email?: string | null; webhookUrl?: string | null; metadata?: any },
) {
  const email = normalizeEmail(input.email ?? null);
  const webhookUrl = normalizeWebhook(input.webhookUrl ?? null);
  if (!email && !webhookUrl) throw new Error("email_or_webhook_required");
  const channel = webhookUrl ? "WEBHOOK" : "EMAIL";

  const record = await prisma.statusPageSubscription.upsert({
    where: webhookUrl
      ? { channel_webhookUrl: { channel, webhookUrl } }
      : { channel_email: { channel, email } },
    update: {
      status: "ACTIVE",
      metadata: input.metadata ?? null,
      secret: webhookUrl ? randomToken(24) : null,
    },
    create: {
      channel,
      status: "ACTIVE",
      email,
      webhookUrl,
      metadata: input.metadata ?? null,
      secret: webhookUrl ? randomToken(24) : null,
    },
  });
  return record;
}

async function notifyStatusSubscribers(
  prisma: AnyPrisma,
  payload: Record<string, any>,
) {
  const active = await prisma.statusPageSubscription.findMany({
    where: { status: "ACTIVE" },
    take: 500,
  }).catch(() => []);
  if (!Array.isArray(active) || active.length === 0) return { delivered: 0 };

  const evidencePayload = {
    kind: "status_page_notification_batch",
    event: payload.event,
    subscribers: active.map((s: any) => ({ id: s.id, channel: s.channel })),
    payload,
  };
  await prisma.complianceEvidence.create({
    data: {
      controlId: null,
      installationId: null,
      evidenceType: "status_page.notification_batch",
      source: "control-plane",
      payload: evidencePayload as any,
      payloadHash: hashEvidencePayload(evidencePayload),
      sourceCapturedAt: new Date(),
      capturedBy: "status-page",
      tags: ["status-page", "incident", "notifications"],
    },
  }).catch(() => null);
  return { delivered: active.length };
}

function serializeIncidentPublic(incident: any) {
  return {
    id: incident.id,
    slug: incident.slug,
    title: incident.title,
    summary: incident.summary,
    impact: incident.impact,
    impactLabel: impactLabel(incident.impact),
    state: incident.state,
    component: incident.component ?? null,
    isClosed: Boolean(incident.isClosed),
    startedAt: incident.startedAt?.toISOString?.() ?? null,
    endedAt: incident.endedAt?.toISOString?.() ?? null,
    publishedAt: incident.publishedAt?.toISOString?.() ?? null,
    closedAt: incident.closedAt?.toISOString?.() ?? null,
    postmortem: incident.postmortemPublishedAt
      ? {
          title: incident.postmortemTitle ?? null,
          body: incident.postmortemBody ?? null,
          publishedAt: incident.postmortemPublishedAt?.toISOString?.() ?? null,
        }
      : null,
    updates: Array.isArray(incident.updates)
      ? incident.updates
          .filter((u: any) => u.isPublic)
          .map((u: any) => ({
            id: u.id,
            message: u.message,
            state: u.state ?? null,
            isPostmortem: Boolean(u.isPostmortem),
            createdAt: u.createdAt?.toISOString?.() ?? null,
            publishedAt: u.publishedAt?.toISOString?.() ?? null,
          }))
      : [],
  };
}

function averageMetrics(rows: any[]) {
  const nums = <T>(mapper: (row: any) => T | number | null | undefined) =>
    rows.map(mapper).filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
  const avg = (arr: number[]) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null);
  return {
    p95Ms: avg(nums((r) => r.sloP95Ms)),
    errorRate: avg(nums((r) => r.sloErrorRate)),
    webhookRetryRate: avg(nums((r) => r.sloWebhookRetryRate)),
  };
}

function normalizeImpact(value: string) {
  const v = String(value ?? "").toUpperCase();
  if (["DEGRADED", "PARTIAL_OUTAGE", "MAJOR_OUTAGE", "MAINTENANCE"].includes(v)) return v;
  return "DEGRADED";
}

function normalizeState(value: string) {
  const v = String(value ?? "").toUpperCase();
  if (["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"].includes(v)) return v;
  return "INVESTIGATING";
}

function impactLabel(value: string) {
  const v = String(value ?? "").toUpperCase();
  if (v === "MAJOR_OUTAGE") return "Major Outage";
  if (v === "PARTIAL_OUTAGE") return "Partial Outage";
  if (v === "MAINTENANCE") return "Maintenance";
  return "Degraded";
}

function slugify(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "incident";
}

function normalizeEmail(input: string | null) {
  const email = String(input ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid_email");
  return email;
}

function normalizeWebhook(input: string | null) {
  const url = String(input ?? "").trim();
  if (!url) return null;
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid_webhook_url");
  return parsed.toString();
}

function randomToken(len: number) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
}

function defaultPostmortemTemplate(input: {
  title: string;
  impact: string;
  startedAt: Date;
  endedAt: Date;
  updates: any[];
  resolutionSummary?: string | null;
}) {
  const timeline = (input.updates ?? [])
    .map((u) => `- ${u.createdAt?.toISOString?.() ?? ""} ${u.state ? `[${u.state}] ` : ""}${u.message}`)
    .join("\n");
  return [
    `# Summary`,
    `${input.title} (${impactLabel(input.impact)})`,
    ``,
    `- Start: ${input.startedAt.toISOString()}`,
    `- End: ${input.endedAt.toISOString()}`,
    `- Resolution: ${input.resolutionSummary ?? "Pending details"}`,
    ``,
    `# Customer Impact`,
    `Describe affected features, segments, and duration.`,
    ``,
    `# Root Cause`,
    `Describe root cause.`,
    ``,
    `# Detection`,
    `How it was detected (alerts / monitoring / customer report).`,
    ``,
    `# Timeline`,
    timeline || "- No timeline updates captured.",
    ``,
    `# Corrective Actions`,
    `- Immediate mitigation`,
    `- Preventive action`,
  ].join("\n");
}

