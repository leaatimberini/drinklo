"use client";

import { useEffect, useState } from "react";

type Incident = any;

export default function StatusPageAdminPage() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    impact: "DEGRADED",
    state: "INVESTIGATING",
    component: "API Fleet",
    isPublic: true,
  });
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, { message: string; state: string; isPublic: boolean }>>({});

  async function refresh() {
    const res = await fetch("/api/status-page/admin", { cache: "no-store" });
    const body = await res.json();
    setData(body);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function act(payload: any) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/status-page/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "request failed");
      setMsg("OK");
      await refresh();
      return body;
    } catch (e: any) {
      setMsg(e?.message ?? "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const incidents: Incident[] = data?.incidents ?? [];

  return (
    <main style={{ padding: 20, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Status Page Admin</h1>
      <p style={{ margin: 0, color: "#666" }}>
        Crear incidentes, publicar updates y postmortems. Resumen público y suscripciones desde control-plane.
      </p>
      {msg ? <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>{msg}</div> : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Create Incident</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={form.title} placeholder="Title" onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <input
            value={form.summary}
            placeholder="Summary"
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <select value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}>
              <option value="DEGRADED">Degraded</option>
              <option value="PARTIAL_OUTAGE">Partial Outage</option>
              <option value="MAJOR_OUTAGE">Major Outage</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
            <select value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
              <option value="INVESTIGATING">Investigating</option>
              <option value="IDENTIFIED">Identified</option>
              <option value="MONITORING">Monitoring</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <input
              value={form.component}
              placeholder="Component"
              onChange={(e) => setForm((f) => ({ ...f, component: e.target.value }))}
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
            />
            Publicar inmediatamente
          </label>
          <button disabled={busy} onClick={() => void act({ action: "create", ...form })}>
            Crear incidente
          </button>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Public Summary</h2>
        <p>
          Status: <strong>{data?.statusLabel ?? "-"}</strong> ({data?.status ?? "-"})
        </p>
        <p>
          Uptime: {data?.metrics?.uptimePct ?? "-"}% · p95: {data?.metrics?.avgP95Ms ?? "-"} ms · err:{" "}
          {data?.metrics?.avgErrorRate != null ? `${(data.metrics.avgErrorRate * 100).toFixed(2)}%` : "-"}
        </p>
        <p>Subscriptions: {Array.isArray(data?.subscriptions) ? data.subscriptions.length : 0}</p>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Incidents</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {incidents.map((inc) => {
            const draft = updateDrafts[inc.id] ?? { message: "", state: inc.state, isPublic: true };
            return (
              <div key={inc.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{inc.title}</strong>
                  <span>
                    {inc.impact} · {inc.state} · {inc.isClosed ? "Closed" : "Open"} · {inc.isPublic ? "Public" : "Private"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  /incident/{inc.slug} · {inc.component ?? "-"} · {new Date(inc.startedAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}>{inc.summary}</div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  <input
                    placeholder="Timeline update message"
                    value={draft.message}
                    onChange={(e) =>
                      setUpdateDrafts((prev) => ({ ...prev, [inc.id]: { ...draft, message: e.target.value } }))
                    }
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto auto", gap: 6 }}>
                    <select
                      value={draft.state}
                      onChange={(e) =>
                        setUpdateDrafts((prev) => ({ ...prev, [inc.id]: { ...draft, state: e.target.value } }))
                      }
                    >
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="IDENTIFIED">Identified</option>
                      <option value="MONITORING">Monitoring</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={draft.isPublic}
                        onChange={(e) =>
                          setUpdateDrafts((prev) => ({ ...prev, [inc.id]: { ...draft, isPublic: e.target.checked } }))
                        }
                      />
                      public
                    </label>
                    <button
                      disabled={busy || !draft.message.trim()}
                      onClick={() => void act({ action: "addUpdate", incidentId: inc.id, ...draft })}
                    >
                      Add update
                    </button>
                    <button disabled={busy} onClick={() => void act({ action: "publish", incidentId: inc.id })}>
                      Publish
                    </button>
                    <button
                      disabled={busy || inc.isClosed}
                      onClick={() => void act({ action: "close", incidentId: inc.id, resolutionSummary: "Resolved by operations" })}
                    >
                      Close
                    </button>
                    <button
                      disabled={busy || !inc.isClosed}
                      onClick={() => void act({ action: "publishPostmortem", incidentId: inc.id })}
                    >
                      Postmortem
                    </button>
                  </div>
                </div>
                {Array.isArray(inc.updates) && inc.updates.length > 0 ? (
                  <ul style={{ marginTop: 8 }}>
                    {inc.updates.slice(-6).map((u: any) => (
                      <li key={u.id} style={{ fontSize: 12 }}>
                        [{u.state ?? "-"}] {u.message} {u.isPublic ? "(public)" : "(private)"} ·{" "}
                        {new Date(u.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {incidents.length === 0 ? <p style={{ color: "#666" }}>No incidents yet.</p> : null}
        </div>
      </section>
    </main>
  );
}

