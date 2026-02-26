"use client";

import { useEffect, useMemo, useState } from "react";

type SecretMeta = {
  id: string;
  provider: string;
  status: string;
  expiresAt?: string | null;
  verifiedAt?: string | null;
  rotatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown> | null;
};

const PROVIDERS = ["MERCADOPAGO", "ANDREANI", "MERCADOLIBRE", "ARCA"] as const;

export default function SecretsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [secrets, setSecrets] = useState<SecretMeta[]>([]);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("MERCADOPAGO");
  const [payload, setPayload] = useState<string>('{"accessToken":""}');
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [verified, setVerified] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payloadHint = useMemo(() => {
    if (provider === "MERCADOPAGO") {
      return '{"accessToken":"...", "publicKey":"..."}';
    }
    if (provider === "ANDREANI") {
      return '{"username":"...", "password":"...", "contract":"", "client":"", "category":"1"}';
    }
    if (provider === "MERCADOLIBRE") {
      return '{"clientId":"...", "clientSecret":"..."}';
    }
    return '{"certPem":"-----BEGIN CERTIFICATE-----...","keyPem":"-----BEGIN PRIVATE KEY-----..."}';
  }, [provider]);

  useEffect(() => {
    setPayload(payloadHint);
  }, [payloadHint]);

  async function loadSecrets() {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/admin/secrets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No autorizado");
      }
      const data = (await res.json()) as SecretMeta[];
      setSecrets(data);
    } catch (err: unknown) {
      setError(err.message ?? "Error al cargar secrets");
    }
  }

  async function rotateSecret() {
    setMessage(null);
    setError(null);
    try {
      const parsed = JSON.parse(payload);
      const res = await fetch(`${apiUrl}/admin/secrets/rotate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          payload: parsed,
          expiresAt: expiresAt || undefined,
          verified,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No autorizado");
      }
      setMessage("Credenciales rotadas.");
      await loadSecrets();
    } catch (err: unknown) {
      setError(err.message ?? "Error al rotar secret");
    }
  }

  async function verifySecret(providerId: string) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/admin/secrets/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider: providerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "No autorizado");
      }
      setMessage("Secret verificado.");
      await loadSecrets();
    } catch (err: unknown) {
      setError(err.message ?? "Error al verificar");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 880 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>
        Vault de credenciales
      </h1>
      <p>Rotar credenciales sin reiniciar servicios. Requiere permiso `settings:write`.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Token JWT
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          style={{ marginTop: 6 }}
        />
      </label>

      <button style={{ marginTop: 12 }} onClick={loadSecrets}>
        Cargar estado
      </button>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}

      <section
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: "var(--radius-md)",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Rotar credenciales</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          Proveedor
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as unknown)}
            style={{ marginTop: 6 }}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Payload JSON
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={6}
            style={{ marginTop: 6, fontFamily: "monospace" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Expira (ISO 8601, opcional)
          <input
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            placeholder="2026-12-31T23:59:59Z"
            style={{ marginTop: 6 }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />
          Marcar como verificado
        </label>

        <button style={{ marginTop: 12 }} onClick={rotateSecret}>
          Rotar
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Estado</h2>
        {secrets.length === 0 && <p>No hay secrets cargados.</p>}
        {secrets.map((secret) => {
          const expired =
            secret.expiresAt && new Date(secret.expiresAt).getTime() < Date.now();
          return (
            <div
              key={secret.id}
              style={{
                padding: 12,
                marginBottom: 12,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--card-border)",
              }}
            >
              <p>
                <strong>Proveedor:</strong> {secret.provider}
              </p>
              <p>
                <strong>Status:</strong> {secret.status}
              </p>
              <p>
                <strong>Verificado:</strong>{" "}
                {secret.verifiedAt ? new Date(secret.verifiedAt).toLocaleString() : "No"}
              </p>
              <p>
                <strong>Expira:</strong>{" "}
                {secret.expiresAt ? new Date(secret.expiresAt).toLocaleString() : "-"}
                {expired ? " (Expirado)" : ""}
              </p>
              <p>
                <strong>Rotado:</strong>{" "}
                {secret.rotatedAt ? new Date(secret.rotatedAt).toLocaleString() : "-"}
              </p>
              {secret.meta && (
                <pre style={{ background: "#f5f5f5", padding: 8 }}>
                  {JSON.stringify(secret.meta, null, 2)}
                </pre>
              )}
              {!secret.verifiedAt && (
                <button style={{ marginTop: 8 }} onClick={() => verifySecret(secret.provider)}>
                  Marcar verificado
                </button>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
