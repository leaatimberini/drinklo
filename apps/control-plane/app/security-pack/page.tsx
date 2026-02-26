"use client";

import { useMemo, useState } from "react";

type InstallationRow = {
  id: string;
  instanceId: string;
  clientName?: string | null;
  domain?: string | null;
  version?: string | null;
  healthStatus?: string | null;
  lastHeartbeatAt?: string | null;
};

export default function SecurityPackPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<InstallationRow[]>([]);
  const [installationId, setInstallationId] = useState("");
  const [jsonPreview, setJsonPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(() => items.find((i) => i.id === installationId) ?? null, [items, installationId]);

  async function fetchApi(path: string, init?: RequestInit) {
    return fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        "x-cp-admin-token": token,
      },
    });
  }

  async function loadInstallations() {
    setLoading(true);
    setMessage(null);
    const res = await fetchApi("/api/security-pack?format=list");
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage((payload as any).error ?? "No se pudo cargar instalaciones");
      return;
    }
    const next = ((payload as any).items ?? []) as InstallationRow[];
    setItems(next);
    if (!installationId && next[0]?.id) setInstallationId(next[0].id);
  }

  async function loadPreview() {
    if (!installationId) {
      setMessage("Seleccioná una instalación.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetchApi(`/api/security-pack?format=json&installationId=${encodeURIComponent(installationId)}`);
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage((payload as any).error ?? "No se pudo generar preview");
      return;
    }
    setJsonPreview(payload);
  }

  async function download(format: "zip" | "pdf") {
    if (!installationId) {
      setMessage("Seleccioná una instalación.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetchApi(`/api/security-pack?format=${format}&installationId=${encodeURIComponent(installationId)}`);
    const blob = await res.blob();
    setLoading(false);
    if (!res.ok) {
      let errorText = "No se pudo generar pack";
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        errorText = parsed.error ?? errorText;
      } catch {
        // ignore non-JSON error body
      }
      setMessage(errorText);
      return;
    }
    const contentDisposition = res.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    const filename = filenameMatch?.[1] ?? `security-pack.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Generado ${format.toUpperCase()} (también guarda evidencia firmada).`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ marginTop: 0 }}>Enterprise Security Pack Export</h1>
      <p style={{ marginTop: 0 }}>
        Procurement pack por instancia con IAM, auditoría, DR, backups, SLOs, SBOM, DAST, accesibilidad y políticas; firmado y evidenciado.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          Control-plane admin token
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="CONTROL_PLANE_ADMIN_TOKEN" />
        </label>
        <button onClick={loadInstallations} disabled={loading || !token}>
          {loading ? "Cargando..." : "Cargar instalaciones"}
        </button>
      </section>

      <section style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          Instalación
          <select value={installationId} onChange={(e) => setInstallationId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.clientName || item.instanceId} ({item.instanceId})
              </option>
            ))}
          </select>
        </label>
        <button onClick={loadPreview} disabled={loading || !installationId || !token}>
          Preview JSON
        </button>
        <button onClick={() => download("pdf")} disabled={loading || !installationId || !token}>
          Descargar PDF resumen
        </button>
        <button onClick={() => download("zip")} disabled={loading || !installationId || !token}>
          Descargar ZIP pack
        </button>
      </section>

      {selected ? (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
          {selected.clientName ?? "-"} · {selected.domain ?? "-"} · version {selected.version ?? "-"} · health {selected.healthStatus ?? "-"}
        </div>
      ) : null}

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}

      {jsonPreview ? (
        <section style={{ marginTop: 16 }}>
          <h2>Preview</h2>
          <pre
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
              maxHeight: 560,
            }}
          >
            {JSON.stringify(jsonPreview, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
