"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FinOpsItem = {
  installationId: string;
  instanceId: string;
  clientName: string | null;
  domain: string | null;
  releaseChannel: string | null;
  estimatedMonthlyCostUsd: number | null;
  estimatedMonthlyCostAvgUsd: number | null;
  estimatedMonthlyCostMaxUsd: number | null;
  cpuUsagePct: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  dbSizeBytes: number | null;
  storageSizeBytes: number | null;
  jobsProcessed1h: number | null;
  jobsPending: number | null;
  finopsUpdatedAt: string | null;
};

type PricingRow = {
  id: string;
  resourceKey: string;
  unit: string;
  usdPerUnit: number;
  description: string | null;
  enabled: boolean;
};

type AlertRow = {
  id: string;
  installationId: string;
  level: string;
  message: string;
  createdAt: string;
};

function formatBytes(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[idx]}`;
}

export default function FinOpsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FinOpsItem[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [totals, setTotals] = useState({ estimatedMonthlyCostUsd: 0, dbSizeBytes: 0, storageSizeBytes: 0 });

  const headers = useMemo(
    () => ({ "x-cp-admin-token": adminToken, "Content-Type": "application/json" }),
    [adminToken],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/finops?days=${days}`, { headers });
      if (!res.ok) {
        setMessage("No se pudieron cargar datos FinOps");
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
      setPricing(json.pricing ?? []);
      setAlerts(json.alerts ?? []);
      setTotals(json.totals ?? { estimatedMonthlyCostUsd: 0, dbSizeBytes: 0, storageSizeBytes: 0 });
    } finally {
      setLoading(false);
    }
  }, [days, headers]);

  useEffect(() => {
    const saved = localStorage.getItem("cp_admin_token");
    if (saved) setAdminToken(saved);
  }, []);

  useEffect(() => {
    if (!adminToken) return;
    localStorage.setItem("cp_admin_token", adminToken);
    void loadData();
  }, [adminToken, loadData]);

  async function savePricing() {
    const res = await fetch("/api/finops", {
      method: "POST",
      headers,
      body: JSON.stringify({ pricing }),
    });
    if (!res.ok) {
      setMessage("No se pudo guardar la tabla de costos");
      return;
    }
    setMessage("Tabla de costos actualizada");
    await loadData();
  }

  async function exportCsv() {
    const res = await fetch("/api/finops/export", { headers });
    if (!res.ok) {
      setMessage("No se pudo exportar CSV");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finops-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>FinOps</h1>

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <label>
          Admin token
          <input value={adminToken} onChange={(event) => setAdminToken(event.target.value)} />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label>
            Rango (dias)
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(event) => setDays(Math.max(1, Math.min(90, Number(event.target.value) || 30)))}
            />
          </label>
          <button onClick={() => void loadData()} disabled={loading}>Refrescar</button>
          <button onClick={() => void exportCsv()} style={{ alignSelf: "end" }}>Export CSV</button>
        </div>

        {message ? <p>{message}</p> : null}
      </section>

      <section className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        <div>
          <strong>Costo mensual estimado total</strong>
          <p>USD {totals.estimatedMonthlyCostUsd.toFixed(2)}</p>
        </div>
        <div>
          <strong>DB total</strong>
          <p>{formatBytes(totals.dbSizeBytes)}</p>
        </div>
        <div>
          <strong>Storage total</strong>
          <p>{formatBytes(totals.storageSizeBytes)}</p>
        </div>
      </section>

      <section className="card">
        <h2>Costos por instancia</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th align="left">Instance</th>
              <th align="left">Cliente</th>
              <th align="left">Costo mensual</th>
              <th align="left">CPU</th>
              <th align="left">RAM</th>
              <th align="left">DB</th>
              <th align="left">Storage</th>
              <th align="left">Jobs</th>
              <th align="left">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.installationId}>
                <td>{item.instanceId}</td>
                <td>{item.clientName ?? "-"}</td>
                <td>
                  {item.estimatedMonthlyCostUsd != null ? `USD ${item.estimatedMonthlyCostUsd.toFixed(2)}` : "-"}
                </td>
                <td>{item.cpuUsagePct != null ? `${item.cpuUsagePct.toFixed(1)}%` : "-"}</td>
                <td>{formatBytes(item.memoryUsedBytes)}</td>
                <td>{formatBytes(item.dbSizeBytes)}</td>
                <td>{formatBytes(item.storageSizeBytes)}</td>
                <td>
                  {item.jobsProcessed1h ?? 0} /h | pendiente {item.jobsPending ?? 0}
                </td>
                <td>{item.finopsUpdatedAt ? new Date(item.finopsUpdatedAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Tabla de costos (configurable)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th align="left">Resource</th>
              <th align="left">Unit</th>
              <th align="left">USD/unit</th>
              <th align="left">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {pricing.map((row, idx) => (
              <tr key={row.id ?? row.resourceKey}>
                <td>{row.resourceKey}</td>
                <td>
                  <input
                    value={row.unit}
                    onChange={(event) => {
                      const next = [...pricing];
                      next[idx] = { ...row, unit: event.target.value };
                      setPricing(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.0001"
                    value={row.usdPerUnit}
                    onChange={(event) => {
                      const next = [...pricing];
                      next[idx] = { ...row, usdPerUnit: Number(event.target.value) };
                      setPricing(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => {
                      const next = [...pricing];
                      next[idx] = { ...row, enabled: event.target.checked };
                      setPricing(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => void savePricing()}>Guardar pricing</button>
      </section>

      <section className="card">
        <h2>Alertas FinOps</h2>
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>
              [{alert.level}] {alert.message} ({new Date(alert.createdAt).toLocaleString()})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
