"use client";

import { useState } from "react";

export default function DemoModePage() {
  const [instanceId, setInstanceId] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<any>(null);

  async function runReset() {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, apiBaseUrl, adminToken, confirmText }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "demo reset failed");
        setOutput(payload);
        return;
      }
      setOutput(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <header>
        <h1>Demo Mode</h1>
        <p>Resetea una instancia demo a snapshot (catalogo, clientes, pedidos, campanas) con protecciones anti-borrado.</p>
      </header>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, maxWidth: 920 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label>
            Instance ID
            <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} placeholder="demo-001" />
          </label>
          <label>
            API Base URL (opcional si la instalación tiene domain)
            <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://tenant.example.com" />
          </label>
          <label>
            Admin JWT Token (instancia)
            <input value={adminToken} onChange={(e) => setAdminToken(e.target.value)} placeholder="JWT" />
          </label>
          <label>
            Confirmación (escribir <code>RESET DEMO</code>)
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET DEMO" />
          </label>
          <button type="button" onClick={runReset} disabled={loading}>
            {loading ? "Reseteando..." : "Reset demo instance"}
          </button>
        </div>
      </section>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {output ? (
        <pre style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, overflowX: "auto" }}>
          {JSON.stringify(output, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

