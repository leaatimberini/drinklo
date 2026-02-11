"use client";

import { useState } from "react";

type HealthResult = {
  provider: string;
  status: "OK" | "WARN" | "FAIL";
  message?: string;
  checkedAt: string;
  meta?: Record<string, any>;
};

type HealthLog = {
  id: string;
  provider: string;
  status: string;
  message?: string | null;
  checkedAt: string;
};

function statusColor(status: string) {
  if (status === "OK") return "#1f7a1f";
  if (status === "WARN") return "#a36d00";
  return "#b00020";
}

export default function IntegrationsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [results, setResults] = useState<HealthResult[]>([]);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/admin/integrations/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No autorizado");
      }
      const data = (await res.json()) as HealthResult[];
      setResults(data);
    } catch (err: any) {
      setError(err.message ?? "Error al consultar health");
    }
  }

  async function loadLogs() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/admin/integrations/logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No autorizado");
      }
      const data = (await res.json()) as HealthLog[];
      setLogs(data);
    } catch (err: any) {
      setError(err.message ?? "Error al cargar logs");
    }
  }

  async function testWebhook() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/admin/integrations/health/mercadopago/webhook-test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No autorizado");
      }
      const data = await res.json();
      setMessage(
        data.duplicateDetected
          ? "Webhook test OK (duplicados detectados)"
          : "Webhook test ejecutado (no se detectó duplicado)",
      );
      await loadLogs();
    } catch (err: any) {
      setError(err.message ?? "Error en webhook test");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 960 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>
        Integraciones
      </h1>
      <p>Health checks y logs de integraciones. Requiere `settings:write`.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Token JWT
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          style={{ marginTop: 6 }}
        />
      </label>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={loadHealth}>Ejecutar health checks</button>
        <button onClick={testWebhook}>Test webhook MP</button>
        <button onClick={loadLogs}>Cargar logs</button>
      </div>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Estado</h2>
        {results.length === 0 && <p>No hay resultados.</p>}
        {results.map((result) => (
          <div
            key={result.provider}
            style={{
              padding: 12,
              marginBottom: 12,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--card-border)",
            }}
          >
            <p>
              <strong>Proveedor:</strong> {result.provider}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span style={{ color: statusColor(result.status) }}>{result.status}</span>
            </p>
            <p>
              <strong>Mensaje:</strong> {result.message ?? "-"}
            </p>
            <p>
              <strong>Checked:</strong> {new Date(result.checkedAt).toLocaleString()}
            </p>
            {result.meta && (
              <pre style={{ background: "#f5f5f5", padding: 8 }}>
                {JSON.stringify(result.meta, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Logs</h2>
        {logs.length === 0 && <p>No hay logs.</p>}
        {logs.map((log) => (
          <div key={log.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong style={{ color: statusColor(log.status) }}>{log.status}</strong>{" "}
            <span>{log.provider}</span> -{" "}
            <span>{log.message ?? "-"}</span>{" "}
            <span style={{ color: "#666" }}>{new Date(log.checkedAt).toLocaleString()}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
