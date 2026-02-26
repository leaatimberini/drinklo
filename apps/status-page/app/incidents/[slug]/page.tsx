import Link from "next/link";
import { notFound } from "next/navigation";
import type { StatusIncidentUpdate } from "../../lib/status-page";
import { fetchPublicIncident, statusBadgeColor } from "../../lib/status-page";

export const revalidate = 30;

export default async function IncidentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const incident = await fetchPublicIncident(slug);
  if (!incident) notFound();

  return (
    <main className="grid">
      <section className="card">
        <Link className="muted" href="/">
          {"<-"} Back to status
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 8 }}>
          <h1 style={{ margin: 0 }}>{incident.title}</h1>
          <span className="badge" style={{ borderColor: statusBadgeColor(incident.impact), color: statusBadgeColor(incident.impact) }}>
            {incident.impactLabel ?? incident.impact}
          </span>
        </div>
        <p className="muted">{incident.summary}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          {incident.component ?? "-"} - Started {incident.startedAt ? new Date(incident.startedAt).toLocaleString() : "-"} - State{" "}
          {incident.state}
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Timeline</h2>
        <div className="grid">
          {(incident.updates ?? []).map((update: StatusIncidentUpdate) => (
            <div key={update.id} style={{ borderLeft: "3px solid #e5e7eb", paddingLeft: 12 }}>
              <div style={{ fontWeight: 600 }}>{update.state ?? incident.state}</div>
              <div>{update.message}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {update.createdAt ? new Date(update.createdAt).toLocaleString() : "-"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {incident.postmortem ? (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Postmortem</h2>
          <h3 style={{ marginTop: 0 }}>{incident.postmortem.title ?? "Postmortem"}</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
            {incident.postmortem.body}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
