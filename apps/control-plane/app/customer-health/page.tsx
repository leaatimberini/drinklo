"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardPayload = {
  generatedAt: string;
  summary: {
    total: number;
    avgScore: number;
    byState: { healthy: number; watch: number; atRisk: number };
  };
  alerts: Array<{
    instanceId: string;
    clientName?: string | null;
    level: string;
    score: number;
    state: string;
    reason: string;
  }>;
  items: Array<{
    installationId: string;
    instanceId: string;
    clientName?: string | null;
    planName?: string | null;
    score: number;
    state: "HEALTHY" | "WATCH" | "AT_RISK";
    components: Record<string, number>;
    reasons: string[];
    playbooksSuggested: string[];
    automation: { csmEmail?: string | null; eligibleAtRisk: boolean };
  }>;
};

export default function CustomerHealthPage() {
  const [take, setTake] = useState(200);
  const [instanceId, setInstanceId] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("take", String(take));
    if (instanceId.trim()) sp.set("instanceId", instanceId.trim());
    return sp.toString();
  }, [take, instanceId]);

  async function load() {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/customer-health?${query}`);
    const payload = (await res.json().catch(() => ({}))) as DashboardPayload & { error?: string };
    setLoading(false);
    if (!res.ok) return setMessage(payload.error ?? "load_failed");
    setData(payload);
  }

  async function runAutomations() {
    setRunning(true);
    setMessage(null);
    const res = await fetch("/api/customer-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "runAutomations", take, instanceId: instanceId.trim() || undefined }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string; tasksCreated?: number; alertsCreated?: number; emailsQueued?: number };
    setRunning(false);
    if (!res.ok) return setMessage(payload.error ?? "automation_failed");
    setMessage(
      `Automations run: tasks=${payload.tasksCreated ?? 0}, alerts=${payload.alertsCreated ?? 0}, emails=${payload.emailsQueued ?? 0}`,
    );
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main>
      <h1>Customer Health Score</h1>
      <p>Post-activación: score 0-100 con estado Healthy / Watch / At Risk, alertas y playbooks sugeridos.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            Instance filter
            <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} placeholder="inst-..." />
          </label>
          <label>
            Take
            <input type="number" min={1} max={500} value={take} onChange={(e) => setTake(Math.max(1, Math.min(500, Number(e.target.value) || 200)))} />
          </label>
          <button onClick={() => void load()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          <button onClick={() => void runAutomations()} disabled={running || loading}>{running ? "Running..." : "Run At-Risk Automations"}</button>
        </div>
        {message ? <p style={{ marginTop: 8 }}>{message}</p> : null}
      </div>

      {data ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h2>Resumen</h2>
            <p>Generado: {new Date(data.generatedAt).toLocaleString()}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px,1fr))", gap: 8 }}>
              <div><strong>Total</strong><div>{data.summary.total}</div></div>
              <div><strong>Avg score</strong><div>{data.summary.avgScore}</div></div>
              <div><strong>Healthy</strong><div>{data.summary.byState.healthy}</div></div>
              <div><strong>Watch</strong><div>{data.summary.byState.watch}</div></div>
              <div><strong>At Risk</strong><div>{data.summary.byState.atRisk}</div></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2>Alertas</h2>
            {data.alerts.length === 0 ? (
              <p>Sin alertas.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Instancia</th>
                    <th style={{ textAlign: "left" }}>Nivel</th>
                    <th style={{ textAlign: "left" }}>Score</th>
                    <th style={{ textAlign: "left" }}>Estado</th>
                    <th style={{ textAlign: "left" }}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.alerts.slice(0, 100).map((row, idx) => (
                    <tr key={`${row.instanceId}:${idx}`} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "8px 0" }}>{row.instanceId}</td>
                      <td style={{ padding: "8px 0" }}>{row.level}</td>
                      <td style={{ padding: "8px 0" }}>{row.score}</td>
                      <td style={{ padding: "8px 0" }}>{row.state}</td>
                      <td style={{ padding: "8px 0" }}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>Instancias</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Instance</th>
                  <th style={{ textAlign: "left" }}>Cliente</th>
                  <th style={{ textAlign: "left" }}>Plan</th>
                  <th style={{ textAlign: "left" }}>Score</th>
                  <th style={{ textAlign: "left" }}>Estado</th>
                  <th style={{ textAlign: "left" }}>Playbooks sugeridos</th>
                  <th style={{ textAlign: "left" }}>CSM</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.installationId} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "8px 0" }}>{item.instanceId}</td>
                    <td style={{ padding: "8px 0" }}>{item.clientName ?? "-"}</td>
                    <td style={{ padding: "8px 0" }}>{item.planName ?? "-"}</td>
                    <td style={{ padding: "8px 0" }}>{item.score}</td>
                    <td style={{ padding: "8px 0" }}>{item.state}</td>
                    <td style={{ padding: "8px 0" }}>{item.playbooksSuggested.join(" | ") || "-"}</td>
                    <td style={{ padding: "8px 0" }}>{item.automation.csmEmail ?? "-"}</td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No installations.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </main>
  );
}
