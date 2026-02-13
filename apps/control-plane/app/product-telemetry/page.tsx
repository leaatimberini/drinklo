import Link from "next/link";
import { prisma } from "../lib/prisma";

function formatBaYmd(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function parseBaRange(fromYmd?: string | null, toYmd?: string | null) {
  const todayYmd = formatBaYmd(new Date());
  const from = (fromYmd ?? "").trim() || formatBaYmd(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const to = (toYmd ?? "").trim() || todayYmd;
  const fromUtc = new Date(`${from}T00:00:00-03:00`);
  const toUtc = new Date(`${to}T23:59:59.999-03:00`);
  return { from, to, fromUtc, toUtc };
}

function clampRange(fromUtc: Date, toUtc: Date) {
  if (Number.isNaN(fromUtc.getTime()) || Number.isNaN(toUtc.getTime()) || fromUtc.getTime() > toUtc.getTime()) {
    const fallback = parseBaRange(null, null);
    return { fromUtc: fallback.fromUtc, toUtc: fallback.toUtc, invalid: true };
  }
  return { fromUtc, toUtc, invalid: false };
}

type UsageRow = {
  instanceId: string;
  feature: string;
  action: string;
  count: number;
};

function summarizeUsage(rows: UsageRow[]) {
  const perInstance = new Map<string, { total: number; byFeature: Map<string, number> }>();
  for (const row of rows) {
    const entry = perInstance.get(row.instanceId) ?? { total: 0, byFeature: new Map<string, number>() };
    entry.total += row.count;
    entry.byFeature.set(row.feature, (entry.byFeature.get(row.feature) ?? 0) + row.count);
    perInstance.set(row.instanceId, entry);
  }
  return perInstance;
}

function computeSignals(input: {
  currentTotal: number;
  prevTotal: number;
  errorAlerts: number;
  jobFailures: number;
  searchOk: boolean | null;
}) {
  const signals: string[] = [];
  const prev = Math.max(0, input.prevTotal);
  const curr = Math.max(0, input.currentTotal);
  const dropPct = prev > 0 ? ((prev - curr) / prev) * 100 : 0;

  if (prev >= 20 && dropPct >= 50) signals.push("USAGE_DROP");
  if (curr === 0) signals.push("NO_USAGE");
  if (input.errorAlerts >= 3) signals.push("RECURRING_ERRORS");
  if (input.jobFailures >= 3) signals.push("JOBS_FAILING");
  if (input.searchOk === false) signals.push("SEARCH_DOWN");

  return { signals, dropPct: Math.round(dropPct) };
}

function playbooksForSignals(signals: string[]) {
  const recs: string[] = [];
  if (signals.includes("NO_USAGE")) {
    recs.push("Reach out: onboarding check, confirm POS/admin access, verify credentials.");
  }
  if (signals.includes("USAGE_DROP")) {
    recs.push("Check last changes: rollout/update history, recent alerts, and SLO metrics.");
    recs.push("Offer training: POS flow, catalog search, and integrations configuration.");
  }
  if (signals.includes("RECURRING_ERRORS")) {
    recs.push("Open Support Portal: download diagnostic bundle and review last errors/jobs.");
  }
  if (signals.includes("JOBS_FAILING")) {
    recs.push("Inspect queues: verify Redis health and retry policy; run smoke.");
  }
  if (signals.includes("SEARCH_DOWN")) {
    recs.push("Verify search engine health (Meilisearch) and reindex job status.");
  }
  return recs.length ? recs : ["No playbook suggestions."];
}

export default async function ProductTelemetryPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const instanceIdFilter = typeof searchParams?.instanceId === "string" ? searchParams?.instanceId.trim() : "";
  const fromParam = typeof searchParams?.from === "string" ? searchParams?.from : null;
  const toParam = typeof searchParams?.to === "string" ? searchParams?.to : null;

  const parsed = parseBaRange(fromParam, toParam);
  const validated = clampRange(parsed.fromUtc, parsed.toUtc);
  const fromUtc = validated.fromUtc;
  const toUtc = validated.toUtc;

  const installations = await prisma.installation.findMany({
    where: instanceIdFilter ? { instanceId: { contains: instanceIdFilter } } : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true,
      instanceId: true,
      domain: true,
      clientName: true,
      version: true,
      releaseChannel: true,
      healthStatus: true,
      searchOk: true,
      lastSeenAt: true,
    },
  });

  const instanceIds = installations.map((i) => i.instanceId);
  const installationIds = installations.map((i) => i.id);

  const featureRows = instanceIds.length
    ? await prisma.featureUsageSample.findMany({
        where: {
          instanceId: { in: instanceIds },
          windowTo: { gte: fromUtc, lte: toUtc },
        },
        select: { instanceId: true, feature: true, action: true, count: true },
        take: 50_000,
      })
    : [];

  const periodMs = toUtc.getTime() - fromUtc.getTime();
  const prevTo = new Date(fromUtc.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - periodMs);

  const prevRows = instanceIds.length
    ? await prisma.featureUsageSample.findMany({
        where: {
          instanceId: { in: instanceIds },
          windowTo: { gte: prevFrom, lte: prevTo },
        },
        select: { instanceId: true, feature: true, action: true, count: true },
        take: 50_000,
      })
    : [];

  const alerts = installationIds.length
    ? await prisma.alert.findMany({
        where: { installationId: { in: installationIds }, createdAt: { gte: fromUtc, lte: toUtc } },
        select: { installationId: true, level: true },
        take: 50_000,
      })
    : [];

  const jobFailures = installationIds.length
    ? await prisma.jobFailure.findMany({
        where: { installationId: { in: installationIds }, createdAt: { gte: fromUtc, lte: toUtc } },
        select: { installationId: true },
        take: 50_000,
      })
    : [];

  const usageByInstance = summarizeUsage(featureRows as UsageRow[]);
  const prevByInstance = summarizeUsage(prevRows as UsageRow[]);

  const alertCounts = new Map<string, number>();
  for (const alert of alerts) {
    if (String(alert.level).toLowerCase() !== "error") continue;
    alertCounts.set(alert.installationId, (alertCounts.get(alert.installationId) ?? 0) + 1);
  }
  const jobFailureCounts = new Map<string, number>();
  for (const row of jobFailures) {
    jobFailureCounts.set(row.installationId, (jobFailureCounts.get(row.installationId) ?? 0) + 1);
  }

  return (
    <main>
      <h1>Product Telemetry</h1>
      <p>Feature adoption and churn signals by installation. Timezone: America/Argentina/Buenos_Aires.</p>
      {validated.invalid && <p style={{ color: "crimson" }}>Invalid date range, using default last 7 days.</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="GET" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            From (BA)
            <input name="from" type="date" defaultValue={parsed.from} />
          </label>
          <label>
            To (BA)
            <input name="to" type="date" defaultValue={parsed.to} />
          </label>
          <label>
            Instance filter
            <input name="instanceId" defaultValue={instanceIdFilter} placeholder="inst-..." />
          </label>
          <button type="submit">Apply</button>
          <Link href="/support" style={{ alignSelf: "center" }}>Support Portal</Link>
        </form>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Client</th>
              <th style={{ textAlign: "left" }}>Version</th>
              <th style={{ textAlign: "left" }}>Usage</th>
              <th style={{ textAlign: "left" }}>Drop</th>
              <th style={{ textAlign: "left" }}>Signals</th>
              <th style={{ textAlign: "left" }}>Top Features</th>
              <th style={{ textAlign: "left" }}>Playbooks</th>
            </tr>
          </thead>
          <tbody>
            {installations.map((inst) => {
              const current = usageByInstance.get(inst.instanceId) ?? { total: 0, byFeature: new Map<string, number>() };
              const prev = prevByInstance.get(inst.instanceId) ?? { total: 0, byFeature: new Map<string, number>() };
              const signalsResult = computeSignals({
                currentTotal: current.total,
                prevTotal: prev.total,
                errorAlerts: alertCounts.get(inst.id) ?? 0,
                jobFailures: jobFailureCounts.get(inst.id) ?? 0,
                searchOk: inst.searchOk,
              });

              const topFeatures = Array.from(current.byFeature.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([feature, count]) => `${feature} (${count})`)
                .join(", ");

              const playbooks = playbooksForSignals(signalsResult.signals);

              return (
                <tr key={inst.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "8px 0" }}>{inst.instanceId}</td>
                  <td style={{ padding: "8px 0" }}>{inst.clientName ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{inst.version ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{current.total}</td>
                  <td style={{ padding: "8px 0" }}>{prev.total > 0 ? `${signalsResult.dropPct}%` : "-"}</td>
                  <td style={{ padding: "8px 0" }}>{signalsResult.signals.length ? signalsResult.signals.join(", ") : "-"}</td>
                  <td style={{ padding: "8px 0" }}>{topFeatures || "-"}</td>
                  <td style={{ padding: "8px 0" }}>{playbooks.join(" | ")}</td>
                </tr>
              );
            })}
            {installations.length === 0 && (
              <tr>
                <td colSpan={8}>No installations.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

