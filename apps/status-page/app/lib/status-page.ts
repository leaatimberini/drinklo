export type StatusSummary = {
  generatedAt: string;
  status: "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE";
  statusLabel: string;
  metrics: {
    instancesTotal: number;
    instancesHealthy: number;
    uptimePct: number;
    avgP95Ms: number | null;
    avgErrorRate: number | null;
    avgWebhookRetryRate: number | null;
  };
  components: Array<{
    key: string;
    name: string;
    status: string;
    uptimePct: number | null;
    latencyP95Ms: number | null;
    errorRate: number | null;
  }>;
  activeIncidents: StatusIncidentSummary[];
  recentIncidents: StatusIncidentSummary[];
};

export type StatusIncidentSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  impact: string;
  impactLabel?: string | null;
  state: string;
  component?: string | null;
  isClosed?: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
};

export type StatusIncidentUpdate = {
  id: string;
  message: string;
  state?: string | null;
  isPostmortem?: boolean;
  createdAt?: string | null;
  publishedAt?: string | null;
};

export type PublicIncident = StatusIncidentSummary & {
  postmortem?: {
    title?: string | null;
    body?: string | null;
    publishedAt?: string | null;
  } | null;
  updates: StatusIncidentUpdate[];
};

export function buildControlPlaneUrl(pathname: string) {
  const base = (process.env.CONTROL_PLANE_URL ?? "http://localhost:3010").replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export async function fetchStatusSummary(): Promise<StatusSummary> {
  const url = buildControlPlaneUrl("/api/status-page/public/summary");
  const res = await fetch(url, { next: { revalidate: 30 } }).catch(() => null);
  if (!res || !res.ok) {
    return fallbackSummary();
  }
  return (await res.json()) as StatusSummary;
}

export async function fetchPublicIncident(slug: string): Promise<PublicIncident | null> {
  const url = buildControlPlaneUrl(`/api/status-page/public/incidents/${encodeURIComponent(slug)}`);
  const res = await fetch(url, { next: { revalidate: 30 } }).catch(() => null);
  if (!res || !res.ok) return null;
  return await res.json();
}

export function statusBadgeColor(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (s === "MAJOR_OUTAGE") return "#b91c1c";
  if (s === "PARTIAL_OUTAGE") return "#c2410c";
  if (s === "DEGRADED") return "#b45309";
  return "#15803d";
}

export function fallbackSummary(): StatusSummary {
  return {
    generatedAt: new Date().toISOString(),
    status: "DEGRADED",
    statusLabel: "Degraded",
    metrics: {
      instancesTotal: 0,
      instancesHealthy: 0,
      uptimePct: 0,
      avgP95Ms: null,
      avgErrorRate: null,
      avgWebhookRetryRate: null,
    },
    components: [],
    activeIncidents: [],
    recentIncidents: [],
  };
}
