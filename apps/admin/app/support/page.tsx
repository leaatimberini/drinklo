"use client";

import { useState } from "react";

type ServiceStatus = {
  name: string;
  url: string;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  checkedAt: string;
};

type SupportSummary = {
  services: ServiceStatus[];
  uptime: { name: string; uptimePct: number }[];
  ops: { errors: any[]; jobFailures: any[] };
  version: { commit: string; buildDate: string };
};

export default function SupportPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSummary() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/support/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("No autorizado o error");
      return;
    }
    setSummary(await res.json());
  }

  async function runSmoke() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/support/smoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("Error en smoke");
      return;
    }
    const data = await res.json();
    setSummary((prev) => (prev ? { ...prev, services: data } : prev));
  }

  function downloadDiagnostic() {
    const url = `${apiUrl}/admin/ops/diagnostic?limit=50`;
    window.open(url, "_blank");
  }

  return (
    <main style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Support Portal</h1>
      <p>Herramientas de soporte y diagnóstico.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={loadSummary}>Cargar estado</button>
        <button onClick={runSmoke}>Ejecutar smoke</button>
        <button onClick={downloadDiagnostic}>Descargar bundle</button>
      </div>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}

      {summary && (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Servicios</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Estado</th>
                <th>Latencia</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {summary.services.map((svc) => (
                <tr key={svc.name}>
                  <td>{svc.name}</td>
                  <td>{svc.ok ? "OK" : "FAIL"}</td>
                  <td>{svc.latencyMs ?? "-"} ms</td>
                  <td>{summary.uptime.find((u) => u.name === svc.name)?.uptimePct ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 20 }}>Ops</h2>
          <p>Errores: {summary.ops.errors.length}</p>
          <p>Jobs fallidos: {summary.ops.jobFailures.length}</p>

          <h2 style={{ marginTop: 20 }}>Version</h2>
          <p>Commit: {summary.version.commit}</p>
          <p>Build: {new Date(summary.version.buildDate).toLocaleString()}</p>
        </section>
      )}
    </main>
  );
}
