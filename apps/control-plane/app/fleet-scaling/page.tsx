"use client";

import { useEffect, useMemo, useState } from "react";

export default function FleetScalingPage() {
  const [overview, setOverview] = useState<any | null>(null);
  const [sim, setSim] = useState<any | null>(null);
  const [instances, setInstances] = useState("5000");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadOverview() {
    setError(null);
    const res = await fetch("/api/fleet-scaling/overview?take=200");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to load fleet overview");
      return;
    }
    setOverview(payload);
  }

  useEffect(() => {
    loadOverview().catch((e) => setError(e.message));
  }, []);

  async function runSimulation() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/fleet-scaling/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instances: Number(instances), shardCount: 64, seed: 42 }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "simulation failed");
      return;
    }
    setSim(payload);
    setMessage(`Simulation completed for ${payload.instances} instances (${payload.stable ? "stable" : "degraded"})`);
  }

  const hottestInstances = useMemo(() => (overview?.items ?? []).slice(0, 15), [overview]);

  return (
    <main>
      <h1>Fleet Scaling</h1>
      <p>Auto-tuning, quotas técnicas y sharding lógico del control-plane para miles de instancias.</p>
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Resumen de fleet</h2>
        <button onClick={() => loadOverview()}>Refresh</button>
        {overview ? (
          <div style={{ marginTop: 8 }}>
            <p>
              Instancias: {overview.quotaSummary?.totalInstances ?? 0} · Violaciones de quota:{" "}
              {overview.quotaSummary?.quotaViolations ?? 0}
            </p>
            <p>
              Planes: starter {overview.quotaSummary?.byPlan?.starter ?? 0} · pro {overview.quotaSummary?.byPlan?.pro ?? 0} · enterprise{" "}
              {overview.quotaSummary?.byPlan?.enterprise ?? 0}
            </p>
            <p>
              Shards (instalaciones): avg {overview.shardDistribution?.avgPerShard ?? 0} · max {overview.shardDistribution?.maxPerShard ?? 0} · imbalance{" "}
              {overview.shardDistribution?.imbalanceRatio ?? 0}
            </p>
            <details>
              <summary>Sharding (métricas/eventos 24h)</summary>
              <pre style={{ background: "#f6f6f6", padding: 8 }}>
                {JSON.stringify(overview.metricsShards24h, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <p>Cargando...</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Auto-tuning (top carga)</h2>
        {hottestInstances.map((item: any) => (
          <div key={item.instanceId} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{item.instanceId}</strong> · plan {item.quota.normalizedPlan} · shard {item.shardKey}
            <div>
              tuning: api {item.tuning.workers.api}, jobs {item.tuning.workers.jobs}, q {item.tuning.queues.defaultConcurrency}, cache ttl {item.tuning.cache.ttlSec}s
            </div>
            <div>
              score {item.tuning.score} · profile {item.tuning.profile} · quota {item.quotaCheck.ok ? "OK" : "EXCEEDED"}
            </div>
            {!item.quotaCheck.ok ? (
              <div style={{ color: "#b45309" }}>
                violaciones: {item.quotaCheck.violations.map((v: any) => `${v.metric} ${v.value}/${v.limit}`).join(", ")}
              </div>
            ) : null}
          </div>
        ))}
        {hottestInstances.length === 0 ? <p>Sin datos.</p> : null}
      </section>

      <section className="card">
        <h2>Simulación N instancias (mock)</h2>
        <label>
          Instancias
          <input value={instances} onChange={(e) => setInstances(e.target.value)} />
        </label>
        <button onClick={runSimulation}>Run Simulation</button>
        {sim ? (
          <pre style={{ background: "#f6f6f6", padding: 8, marginTop: 8 }}>
            {JSON.stringify(
              {
                stable: sim.stable,
                instances: sim.instances,
                summary: sim.summary,
                shardDistribution: {
                  avgPerShard: sim.shardDistribution?.avgPerShard,
                  maxPerShard: sim.shardDistribution?.maxPerShard,
                  imbalanceRatio: sim.shardDistribution?.imbalanceRatio,
                },
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </section>
    </main>
  );
}

