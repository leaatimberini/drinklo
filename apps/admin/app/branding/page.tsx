"use client";

import { useState } from "react";

export default function BrandingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [exportData, setExportData] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [superToken, setSuperToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function doExport() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/branding/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      setMessage("Export failed");
      return;
    }
    const data = await res.json();
    setExportData(JSON.stringify(data, null, 2));
  }

  async function doImport(apply: boolean) {
    setMessage(null);
    let payload;
    try {
      payload = JSON.parse(importPayload);
    } catch {
      setMessage("Invalid JSON");
      return;
    }

    const res = await fetch(`${apiUrl}/admin/branding/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-superadmin-token": superToken,
      },
      body: JSON.stringify({ ...payload, apply }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data?.message ?? "Import failed");
      return;
    }
    setMessage(apply ? "Import applied" : "Preview ready");
    if (data.preview) {
      setExportData(JSON.stringify(data.preview, null, 2));
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 820 }}>
      <h1 style={{ fontSize: 28, fontFamily: "var(--font-heading)" }}>Exportar/Importar marca</h1>

      <section style={{ marginTop: 16 }}>
        <h2>Export</h2>
        <label>
          JWT Token
          <input value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        <button style={{ marginTop: 8 }} onClick={doExport}>
          Exportar
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Import</h2>
        <label>
          Superadmin token (local)
          <input value={superToken} onChange={(e) => setSuperToken(e.target.value)} />
        </label>
        <textarea
          rows={10}
          value={importPayload}
          onChange={(e) => setImportPayload(e.target.value)}
          placeholder="{ payload, signature }"
          style={{ marginTop: 8 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => doImport(false)}>Preview</button>
          <button onClick={() => doImport(true)}>Apply</button>
        </div>
      </section>

      {exportData && (
        <section style={{ marginTop: 24 }}>
          <h2>Payload</h2>
          <pre style={{ background: "#111", color: "#e5e5e5", padding: 12, borderRadius: 8 }}>
            {exportData}
          </pre>
        </section>
      )}

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </main>
  );
}
