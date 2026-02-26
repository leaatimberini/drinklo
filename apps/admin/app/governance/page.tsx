"use client";

import { useEffect, useMemo, useState } from "react";

type PolicyRow = {
  id: string;
  plan: "starter" | "pro" | "enterprise";
  entity: "ORDERS" | "LOGS" | "EVENTS" | "MARKETING";
  retentionDays: number;
};

type HoldRow = {
  id: string;
  customerId: string;
  customerEmailSnapshot?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  status: "ACTIVE" | "RELEASED";
  reason: string;
  createdAt: string;
};

export default function GovernancePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [effective, setEffective] = useState<unknown>(null);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [runs, setRuns] = useState<unknown[]>([]);
  const [holdForm, setHoldForm] = useState({ customerId: "", periodFrom: "", periodTo: "", reason: "" });

  const grouped = useMemo(() => {
    const map = new Map<string, PolicyRow[]>();
    for (const row of policies) {
      const key = row.plan;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [policies]);

  async function fetchJson(path: string, init?: RequestInit) {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message ?? "Request failed");
    }
    return res.json();
  }

  async function loadAll() {
    setError(null);
    setMessage(null);
    try {
      const [p, e, h, r] = await Promise.all([
        fetchJson("/admin/governance/policies"),
        fetchJson("/admin/governance/policies/effective"),
        fetchJson("/admin/governance/legal-holds"),
        fetchJson("/admin/governance/purge/runs?limit=20"),
      ]);
      setPolicies(p);
      setEffective(e);
      setHolds(h);
      setRuns(r);
    } catch (err: unknown) {
      setError(err.message ?? "Error al cargar");
    }
  }

  useEffect(() => {
    if (token) {
      void loadAll();
    }
  }, [token]);

  async function savePolicies() {
    setError(null);
    setMessage(null);
    try {
      const items = policies.map((p) => ({ plan: p.plan, entity: p.entity, retentionDays: Number(p.retentionDays) }));
      await fetchJson("/admin/governance/policies", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      setMessage("Politicas guardadas");
      await loadAll();
    } catch (err: unknown) {
      setError(err.message ?? "Error al guardar politicas");
    }
  }

  async function createHold() {
    setError(null);
    setMessage(null);
    try {
      await fetchJson("/admin/governance/legal-holds", {
        method: "POST",
        body: JSON.stringify({
          customerId: holdForm.customerId,
          periodFrom: holdForm.periodFrom || undefined,
          periodTo: holdForm.periodTo || undefined,
          reason: holdForm.reason,
        }),
      });
      setMessage("Legal hold creado");
      setHoldForm({ customerId: "", periodFrom: "", periodTo: "", reason: "" });
      await loadAll();
    } catch (err: unknown) {
      setError(err.message ?? "Error al crear legal hold");
    }
  }

  async function releaseHold(id: string) {
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/admin/governance/legal-holds/${id}/release`, {
        method: "POST",
        body: JSON.stringify({ reason: "released from admin panel" }),
      });
      setMessage("Legal hold liberado");
      await loadAll();
    } catch (err: unknown) {
      setError(err.message ?? "Error al liberar legal hold");
    }
  }

  async function runPurge() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetchJson("/admin/governance/purge/run", { method: "POST" });
      setMessage(`Purge ejecutado: ${res.runId}`);
      await loadAll();
    } catch (err: unknown) {
      setError(err.message ?? "Error al ejecutar purge");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1200 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 30 }}>Gobierno de datos</h1>
      <p style={{ color: "#555" }}>Retencion por plan, legal hold y ejecucion de purga.</p>

      <section style={{ marginTop: 16 }}>
        <label>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <button style={{ marginLeft: 8 }} onClick={loadAll}>Recargar</button>
      </section>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Politicas por plan/entidad</h2>
        {grouped.map(([plan, rows]) => (
          <div key={plan} style={{ marginBottom: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <strong>{plan}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 8, marginTop: 8 }}>
              {rows.map((row) => (
                <label key={row.id}>
                  {row.entity}
                  <input
                    type="number"
                    min={1}
                    value={row.retentionDays}
                    onChange={(e) =>
                      setPolicies((prev) =>
                        prev.map((candidate) =>
                          candidate.id === row.id
                            ? { ...candidate, retentionDays: Number(e.target.value) }
                            : candidate,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button onClick={savePolicies}>Guardar politicas</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Politica efectiva</h2>
        <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8 }}>{JSON.stringify(effective, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Legal hold</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 8 }}>
          <input placeholder="customerId" value={holdForm.customerId} onChange={(e) => setHoldForm({ ...holdForm, customerId: e.target.value })} />
          <input type="date" value={holdForm.periodFrom} onChange={(e) => setHoldForm({ ...holdForm, periodFrom: e.target.value ? `${e.target.value}T00:00:00.000Z` : "" })} />
          <input type="date" value={holdForm.periodTo} onChange={(e) => setHoldForm({ ...holdForm, periodTo: e.target.value ? `${e.target.value}T23:59:59.999Z` : "" })} />
          <input placeholder="reason" value={holdForm.reason} onChange={(e) => setHoldForm({ ...holdForm, reason: e.target.value })} />
        </div>
        <button style={{ marginTop: 8 }} onClick={createHold}>Crear hold</button>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {holds.map((hold) => (
            <div key={hold.id} style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 10 }}>
              <div>
                <strong>{hold.status}</strong> - customer {hold.customerId} ({hold.customerEmailSnapshot ?? "sin email"})
              </div>
              <div>{hold.reason}</div>
              <small>
                {hold.periodFrom ?? "-"} / {hold.periodTo ?? "-"}
              </small>
              {hold.status === "ACTIVE" && (
                <div>
                  <button style={{ marginTop: 6 }} onClick={() => releaseHold(hold.id)}>Liberar hold</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Ejecuciones de purge</h2>
        <button onClick={runPurge}>Ejecutar purge manual</button>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {runs.map((run) => (
            <details key={run.id} style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 10 }}>
              <summary>
                {run.status} - {new Date(run.startedAt).toLocaleString()} - {run.triggerType}
              </summary>
              <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 8 }}>{JSON.stringify(run.summary, null, 2)}</pre>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
