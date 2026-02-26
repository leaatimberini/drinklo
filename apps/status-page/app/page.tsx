import Link from "next/link";
import { fetchStatusSummary, statusBadgeColor } from "./lib/status-page";

export const revalidate = 30;

export default async function StatusPageHome() {
  const summary = await fetchStatusSummary();

  return (
    <main className="grid">
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>Platform Status</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Last updated: {new Date(summary.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="badge" style={{ borderColor: statusBadgeColor(summary.status), color: statusBadgeColor(summary.status) }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: statusBadgeColor(summary.status) }} />
            {summary.statusLabel}
          </div>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <div className="card">
          <div className="muted">Uptime</div>
          <strong>{summary.metrics.uptimePct}%</strong>
        </div>
        <div className="card">
          <div className="muted">Instances</div>
          <strong>
            {summary.metrics.instancesHealthy}/{summary.metrics.instancesTotal}
          </strong>
        </div>
        <div className="card">
          <div className="muted">Avg p95</div>
          <strong>{summary.metrics.avgP95Ms ?? "-"} ms</strong>
        </div>
        <div className="card">
          <div className="muted">Error Rate</div>
          <strong>
            {summary.metrics.avgErrorRate != null ? `${(summary.metrics.avgErrorRate * 100).toFixed(2)}%` : "-"}
          </strong>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Components</h2>
        <div className="grid">
          {summary.components.map((component) => (
            <div key={component.key} style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{component.name}</strong>
                <span className="badge" style={{ borderColor: statusBadgeColor(component.status), color: statusBadgeColor(component.status) }}>
                  {component.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                uptime {component.uptimePct ?? "-"}% - p95 {component.latencyP95Ms ?? "-"} ms - err{" "}
                {component.errorRate != null ? `${(component.errorRate * 100).toFixed(2)}%` : "-"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Active Incidents</h2>
        <div className="grid">
          {summary.activeIncidents.length === 0 ? <p className="muted">No active incidents.</p> : null}
          {summary.activeIncidents.map((incident) => (
            <Link key={incident.id} href={`/incidents/${incident.slug}`}>
              <div style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{incident.title}</strong>
                  <span className="badge" style={{ borderColor: statusBadgeColor(incident.impact), color: statusBadgeColor(incident.impact) }}>
                    {incident.impactLabel ?? incident.impact}
                  </span>
                </div>
                <div className="muted" style={{ marginTop: 6 }}>{incident.summary}</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  {incident.component ?? "-"} - {incident.startedAt ? new Date(incident.startedAt).toLocaleString() : "-"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Recent Incidents</h2>
        <div className="grid">
          {summary.recentIncidents.map((incident) => (
            <Link key={incident.id} href={`/incidents/${incident.slug}`}>
              <div style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{incident.title}</strong>
                  <span className="muted">{incident.isClosed ? "Closed" : "Open"}</span>
                </div>
                <div className="muted" style={{ marginTop: 6 }}>{incident.summary}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
