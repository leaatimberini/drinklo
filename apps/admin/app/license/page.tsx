"use client";

import { useEffect, useState } from "react";

type LicenseStatus = {
  valid: boolean;
  plan: string | null;
  expiresAt: string | null;
  features: string[];
  source: "local" | "remote";
  reason?: string;
};

export default function LicensePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
  }, [apiUrl]);

  async function fetchStatus() {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/admin/license`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message ?? "No autorizado");
      }
      const data = (await res.json()) as LicenseStatus;
      setStatus(data);
    } catch (err: any) {
      setError(err.message ?? "Error al consultar licencia");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Licencia</h1>
      <p>Ver estado de licencia de la instancia.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Token JWT
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          style={{ marginTop: 6 }}
        />
      </label>

      <button style={{ marginTop: 12 }} onClick={fetchStatus}>
        Consultar
      </button>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}

      {status && (
        <section
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: "var(--radius-md)",
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <p>
            <strong>Estado:</strong> {status.valid ? "Vigente" : "No vigente"}
          </p>
          <p>
            <strong>Plan:</strong> {status.plan ?? "-"}
          </p>
          <p>
            <strong>Vence:</strong> {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : "-"}
          </p>
          <p>
            <strong>Fuente:</strong> {status.source}
          </p>
          <p>
            <strong>Features:</strong> {(status.features ?? []).join(", ") || "-"}
          </p>
          {status.reason && (
            <p>
              <strong>Motivo:</strong> {status.reason}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
