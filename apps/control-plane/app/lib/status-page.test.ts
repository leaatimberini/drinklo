import assert from "node:assert/strict";
import test from "node:test";
import {
  closeStatusIncident,
  createStatusIncident,
  loadStatusPagePublicSummary,
  publishIncidentPostmortem,
  publishStatusIncident,
} from "./status-page";

type IncidentImpact = "DEGRADED" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE" | "MAINTENANCE";
type IncidentState = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

type IncidentRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  impact: IncidentImpact;
  state: IncidentState;
  component: string | null;
  installationId: string | null;
  isPublic: boolean;
  isClosed: boolean;
  publishedAt: Date | null;
  closedAt: Date | null;
  startedAt: Date;
  endedAt: Date | null;
  postmortemTitle: string | null;
  postmortemBody: string | null;
  postmortemPublishedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
};

type IncidentUpdateRecord = {
  id: string;
  incidentId: string;
  state: IncidentState | null;
  message: string;
  isPublic: boolean;
  isPostmortem: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
};

type InstallationRow = {
  id: string;
  instanceId: string;
  clientName: string;
  domain: string | null;
  healthStatus: string;
  searchOk: boolean | null;
  sloP95Ms: number | null;
  sloErrorRate: number | null;
  sloWebhookRetryRate: number | null;
  sloUpdatedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastSeenAt: Date | null;
};

function createFakeStatusPrisma() {
  const incidents: IncidentRecord[] = [];
  const updates: IncidentUpdateRecord[] = [];
  const installations: InstallationRow[] = [
    {
      id: "inst-1",
      instanceId: "i_1",
      clientName: "Cliente 1",
      domain: "example.com",
      healthStatus: "healthy",
      searchOk: true,
      sloP95Ms: 220,
      sloErrorRate: 0.004,
      sloWebhookRetryRate: 0.001,
      sloUpdatedAt: new Date(),
      lastHeartbeatAt: new Date(),
      lastSeenAt: new Date(),
    },
  ];
  let incidentSeq = 0;
  let updateSeq = 0;

  const withUpdates = <T extends IncidentRecord>(incident: T, includeAll = true) => ({
    ...incident,
    updates: updates
      .filter((u) => u.incidentId === incident.id)
      .filter((u) => (includeAll ? true : u.isPublic))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  });

  return {
    _state: { incidents, updates, installations },
    installation: {
      async findMany() {
        return installations;
      },
    },
    statusPageIncident: {
      async create({ data }: { data: Partial<IncidentRecord> }) {
        incidentSeq += 1;
        const incident: IncidentRecord = {
          id: `inc-${incidentSeq}`,
          slug: String(data.slug ?? `incident-${incidentSeq}`),
          title: String(data.title ?? ""),
          summary: String(data.summary ?? ""),
          impact: (data.impact as IncidentImpact) ?? "DEGRADED",
          state: (data.state as IncidentState) ?? "INVESTIGATING",
          component: (data.component as string | null) ?? null,
          installationId: (data.installationId as string | null) ?? null,
          isPublic: Boolean(data.isPublic),
          isClosed: false,
          publishedAt: (data.publishedAt as Date | null) ?? null,
          closedAt: null,
          startedAt: new Date(),
          endedAt: null,
          postmortemTitle: null,
          postmortemBody: null,
          postmortemPublishedAt: null,
          createdBy: (data.createdBy as string | null) ?? null,
          updatedBy: (data.updatedBy as string | null) ?? null,
        };
        incidents.push(incident);
        return incident;
      },
      async findUnique({
        where,
        include,
      }: {
        where: { id: string };
        include?: { updates?: { orderBy?: { createdAt: "asc" | "desc" } } };
      }) {
        const incident = incidents.find((i) => i.id === where.id) ?? null;
        if (!incident) return null;
        return include?.updates ? withUpdates(incident) : incident;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<IncidentRecord> }) {
        const incident = incidents.find((i) => i.id === where.id);
        if (!incident) throw new Error("incident_not_found");
        Object.assign(incident, data);
        return incident;
      },
      async findMany({
        where,
        include,
        take,
      }: {
        where?: { isPublic?: boolean };
        include?: { updates?: { where?: { isPublic?: boolean }; orderBy?: { createdAt: "asc" | "desc" } } };
        orderBy?: unknown;
        take?: number;
      }) {
        let rows = [...incidents];
        if (where?.isPublic !== undefined) {
          rows = rows.filter((i) => i.isPublic === where.isPublic);
        }
        rows.sort((a, b) => {
          if (a.isClosed !== b.isClosed) return Number(a.isClosed) - Number(b.isClosed);
          return b.startedAt.getTime() - a.startedAt.getTime();
        });
        if (typeof take === "number") rows = rows.slice(0, take);
        if (!include?.updates) return rows;
        return rows.map((incident) => ({
          ...incident,
          updates: updates
            .filter((u) => u.incidentId === incident.id)
            .filter((u) => (include.updates?.where?.isPublic !== undefined ? u.isPublic === include.updates.where.isPublic : true))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        }));
      },
    },
    statusPageIncidentUpdate: {
      async create({ data }: { data: Partial<IncidentUpdateRecord> }) {
        updateSeq += 1;
        const row: IncidentUpdateRecord = {
          id: `upd-${updateSeq}`,
          incidentId: String(data.incidentId),
          state: (data.state as IncidentState | null) ?? null,
          message: String(data.message ?? ""),
          isPublic: Boolean(data.isPublic),
          isPostmortem: Boolean(data.isPostmortem),
          publishedAt: (data.publishedAt as Date | null) ?? null,
          createdAt: new Date(),
          createdBy: (data.createdBy as string | null) ?? null,
        };
        updates.push(row);
        return row;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { incidentId?: string; isPublic?: boolean; publishedAt?: null };
        data: Partial<IncidentUpdateRecord>;
      }) {
        let count = 0;
        for (const row of updates) {
          if (where.incidentId && row.incidentId !== where.incidentId) continue;
          if (where.isPublic !== undefined && row.isPublic !== where.isPublic) continue;
          if (where.publishedAt === null && row.publishedAt !== null) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
    statusPageSubscription: {
      async findMany() {
        return [] as Array<{ id: string; channel: string }>;
      },
    },
    complianceEvidence: {
      async create() {
        return { id: "ev-1" };
      },
    },
  };
}

test("status incident publication workflow exposes only published incidents and postmortem", async () => {
  const prisma = createFakeStatusPrisma();

  const draftIncident = await createStatusIncident(prisma, {
    title: "API latency spike",
    summary: "Investigating elevated p95 latency.",
    impact: "DEGRADED",
    isPublic: false,
    createdBy: "cp:admin",
  });

  let summary = await loadStatusPagePublicSummary(prisma);
  assert.equal(summary.activeIncidents.length, 0);
  assert.equal(summary.recentIncidents.length, 0);

  await publishStatusIncident(prisma, { incidentId: draftIncident.id, actor: "cp:admin" });
  await closeStatusIncident(prisma, {
    incidentId: draftIncident.id,
    actor: "cp:admin",
    resolutionSummary: "Rolled back a bad cache config.",
  });
  await publishIncidentPostmortem(prisma, { incidentId: draftIncident.id, actor: "cp:admin" });

  summary = await loadStatusPagePublicSummary(prisma);
  assert.equal(summary.activeIncidents.length, 0);
  assert.equal(summary.recentIncidents.length, 1);
  const incident = summary.recentIncidents[0] as { slug: string; isClosed: boolean; postmortem?: { body?: string | null } | null };
  assert.equal(incident.isClosed, true);
  assert.equal(incident.slug.includes("api-latency-spike"), true);
  assert.equal(Boolean(incident.postmortem?.body?.includes("# Summary")), true);
});

