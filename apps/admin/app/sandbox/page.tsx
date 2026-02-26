"use client";

import { useEffect, useState } from "react";

export default function SandboxPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchJson(path: string, init?: RequestInit) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message ?? "Request failed");
    }
    return response.json();
  }

  async function loadStatus() {
    setError(null);
    try {
      const data = await fetchJson("/admin/sandbox/status");
      setStatus(data);
    } catch (err: unknown) {
      setError(err.message ?? "No se pudo cargar estado");
    }
  }

  useEffect(() => {
    if (token) {
      void loadStatus();
    }
  }, [token]);

  async function setMode(enabled: boolean) {
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/admin/sandbox/mode", {
        method: "POST",
        body: JSON.stringify({ sandboxMode: enabled }),
      });
      setMessage(`Sandbox ${enabled ? "activado" : "desactivado"}`);
      await loadStatus();
    } catch (err: unknown) {
      setError(err.message ?? "No se pudo actualizar modo");
    }
  }

  async function resetSandbox() {
    setMessage(null);
    setError(null);
    try {
      await fetchJson("/admin/sandbox/reset", { method: "POST" });
      setMessage("Sandbox reiniciado a estado inicial");
      await loadStatus();
    } catch (err: unknown) {
      setError(err.message ?? "No se pudo resetear sandbox");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 30, fontFamily: "var(--font-heading)" }}>Sandbox</h1>
      <p style={{ color: "#555" }}>Modo sandbox por company con mocks deterministas.</p>

      <section style={{ marginTop: 16 }}>
        <label>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <button style={{ marginLeft: 8 }} onClick={loadStatus}>Recargar</button>
      </section>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Estado</h2>
        <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>{JSON.stringify(status, null, 2)}</pre>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Acciones</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMode(true)}>Activar Sandbox</button>
          <button onClick={() => setMode(false)}>Desactivar Sandbox</button>
          <button onClick={resetSandbox}>Sandbox Reset</button>
        </div>
      </section>
    </main>
  );
}
