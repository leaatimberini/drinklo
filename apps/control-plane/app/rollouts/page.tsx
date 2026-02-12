"use client";

import { useEffect, useMemo, useState } from "react";

type RolloutJob = {
  id: string;
  installationId: string;
  status: string;
  step: string | null;
  canaryPercent: number | null;
  metricP95Ms: number | null;
  metricErrorRate: number | null;
  metricWebhookRetryRate: number | null;
  updatedAt: string;
};

type RolloutBatch = {
  id: string;
  batchIndex: number;
  status: string;
  updateJobs: RolloutJob[];
};

type RolloutItem = {
  id: string;
  strategy: string;
  channel: string;
  status: string;
  canarySteps: number[];
  canaryStepWaitSec: number;
  sloP95Max: number | null;
  sloErrorRateMax: number | null;
  sloWebhookRetryRateMax: number | null;
  createdAt: string;
  manifest: { id: string; version: string; sha: string };
  batches: RolloutBatch[];
};

type ReleaseManifest = { id: string; version: string; sha: string; channel: string };

export default function RolloutsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [manifests, setManifests] = useState<ReleaseManifest[]>([]);
  const [rollouts, setRollouts] = useState<RolloutItem[]>([]);

  const [manifestId, setManifestId] = useState("");
  const [channel, setChannel] = useState("stable");
  const [batchSize, setBatchSize] = useState(10);
  const [strategy, setStrategy] = useState("BLUE_GREEN_CANARY");
  const [canaryStepsText, setCanaryStepsText] = useState("5,25,100");
  const [canaryWaitSec, setCanaryWaitSec] = useState(120);
  const [sloP95Max, setSloP95Max] = useState(800);
  const [sloErrorRateMax, setSloErrorRateMax] = useState(0.02);
  const [sloWebhookRetryRateMax, setSloWebhookRetryRateMax] = useState(0.1);
  const [autoRollback, setAutoRollback] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const headers = useMemo(
    () => ({ "x-admin-token": adminToken, "Content-Type": "application/json" }),
    [adminToken],
  );

  useEffect(() => {
    const saved = localStorage.getItem("cp_admin_token");
    if (saved) setAdminToken(saved);
  }, []);

  useEffect(() => {
    if (!adminToken) return;
    localStorage.setItem("cp_admin_token", adminToken);
    void loadData();
  }, [adminToken]);

  async function loadData() {
    const [rolloutsRes, manifestsRes] = await Promise.all([
      fetch("/api/rollouts", { headers }),
      fetch("/api/releases", { headers: { "x-admin-token": adminToken } }),
    ]);

    if (rolloutsRes.ok) {
      const json = await rolloutsRes.json();
      setRollouts(json.items ?? []);
    }

    if (manifestsRes.ok) {
      const json = await manifestsRes.json();
      setManifests(json.items ?? []);
      if (!manifestId && json.items?.length > 0) {
        setManifestId(json.items[0].id);
        setChannel(json.items[0].channel ?? "stable");
      }
    }
  }

  async function scheduleRollout() {
    setMessage(null);
    const canarySteps = canaryStepsText
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));

    const res = await fetch("/api/rollouts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        manifestId,
        channel,
        batchSize,
        strategy,
        canarySteps,
        canaryStepWaitSec: canaryWaitSec,
        sloP95Max,
        sloErrorRateMax,
        sloWebhookRetryRateMax,
        autoRollback,
      }),
    });

    if (!res.ok) {
      setMessage("No se pudo programar rollout");
      return;
    }

    setMessage("Rollout programado");
    await loadData();
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Blue/Green + Canary Rollouts</h1>

      <label>
        Admin token
        <input value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
      </label>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
        <h2>Programar rollout</h2>
        <label>
          Manifest
          <select value={manifestId} onChange={(e) => setManifestId(e.target.value)}>
            <option value="">Seleccionar</option>
            {manifests.map((manifest) => (
              <option key={manifest.id} value={manifest.id}>
                {manifest.version} ({manifest.channel}) {manifest.sha.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
          <label>
            Canal
            <input value={channel} onChange={(e) => setChannel(e.target.value)} />
          </label>
          <label>
            Batch size
            <input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
          </label>
          <label>
            Estrategia
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option value="BLUE_GREEN_CANARY">BLUE_GREEN_CANARY</option>
              <option value="BATCH">BATCH</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
          <label>
            Canary %
            <input value={canaryStepsText} onChange={(e) => setCanaryStepsText(e.target.value)} />
          </label>
          <label>
            Wait sec
            <input type="number" value={canaryWaitSec} onChange={(e) => setCanaryWaitSec(Number(e.target.value))} />
          </label>
          <label>
            SLO p95 max
            <input type="number" value={sloP95Max} onChange={(e) => setSloP95Max(Number(e.target.value))} />
          </label>
          <label>
            SLO err max
            <input
              type="number"
              step="0.001"
              value={sloErrorRateMax}
              onChange={(e) => setSloErrorRateMax(Number(e.target.value))}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
          <label>
            SLO webhook retry max
            <input
              type="number"
              step="0.001"
              value={sloWebhookRetryRateMax}
              onChange={(e) => setSloWebhookRetryRateMax(Number(e.target.value))}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
            <input type="checkbox" checked={autoRollback} onChange={(e) => setAutoRollback(e.target.checked)} />
            Auto rollback
          </label>
        </div>

        <button onClick={scheduleRollout}>Programar</button>
        {message && <p>{message}</p>}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2>Rollouts</h2>
        <button onClick={loadData}>Refrescar</button>

        {rollouts.map((rollout) => (
          <article key={rollout.id} style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <p>
              <strong>{rollout.id.slice(0, 8)}</strong> {rollout.strategy} {rollout.channel} {rollout.status}
            </p>
            <p>
              Manifest {rollout.manifest.version} ({rollout.manifest.sha.slice(0, 8)}) | Canary {rollout.canarySteps.join(" -> ")}
            </p>

            {rollout.batches.map((batch) => (
              <div key={batch.id} style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                <p>
                  Batch #{batch.batchIndex} {batch.status}
                </p>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th align="left">Job</th>
                      <th align="left">Status</th>
                      <th align="left">Step</th>
                      <th align="left">Canary</th>
                      <th align="left">p95</th>
                      <th align="left">Error</th>
                      <th align="left">Webhook retry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.updateJobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.id.slice(0, 8)}</td>
                        <td>{job.status}</td>
                        <td>{job.step ?? "-"}</td>
                        <td>{job.canaryPercent != null ? `${job.canaryPercent}%` : "-"}</td>
                        <td>{job.metricP95Ms != null ? `${Math.round(job.metricP95Ms)}ms` : "-"}</td>
                        <td>{job.metricErrorRate != null ? `${(job.metricErrorRate * 100).toFixed(2)}%` : "-"}</td>
                        <td>
                          {job.metricWebhookRetryRate != null
                            ? `${(job.metricWebhookRetryRate * 100).toFixed(2)}%`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
