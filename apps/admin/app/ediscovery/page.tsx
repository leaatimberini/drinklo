"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const defaultExportReq = {
  entities: ["orders", "invoices", "audit", "events", "config_changes", "accesses", "legal_holds"],
};

export default function EdiscoveryPage() {
  const [token, setToken] = useState("");
  const [reqJson, setReqJson] = useState(JSON.stringify(defaultExportReq, null, 2));
  const [packJson, setPackJson] = useState("");
  const [verifyResult, setVerifyResult] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  async function exportPack() {
    setMessage(null);
    try {
      const body = JSON.parse(reqJson || "{}");
      const res = await fetch(`${apiUrl}/admin/ediscovery/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const text = await res.text();
      setPackJson(text);
      setMessage("Export forense generado");
    } catch (error: any) {
      setMessage(`Error exportando: ${error.message}`);
    }
  }

  async function verifyPack() {
    setMessage(null);
    try {
      const pack = JSON.parse(packJson);
      const res = await fetch(`${apiUrl}/admin/ediscovery/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pack }),
      });
      const text = await res.text();
      setVerifyResult(text);
      if (!res.ok) throw new Error(text);
      setMessage("Verificación OK");
    } catch (error: any) {
      setMessage(`Error verificando: ${error.message}`);
    }
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>eDiscovery & Legal</h1>
      <p style={{ margin: 0 }}>
        Export forense firmado (pedidos, facturas, auditoría, eventos, cambios de configuración, accesos) y verificación.
      </p>

      <label style={{ display: "grid", gap: 6 }}>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Solicitud de export</h2>
        <textarea
          rows={10}
          value={reqJson}
          onChange={(e) => setReqJson(e.target.value)}
          style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={exportPack}>Generar export</button>
          <button onClick={verifyPack}>Verificar export cargado</button>
        </div>
      </section>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Export JSON firmado</h2>
        <textarea
          rows={18}
          value={packJson}
          onChange={(e) => setPackJson(e.target.value)}
          style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace" }}
          placeholder="Acá aparece el pack generado (o pegá uno para verificar)"
        />
      </section>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Resultado de verificación</h2>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{verifyResult || "Sin verificación aún"}</pre>
      </section>

      {message && <p>{message}</p>}
    </main>
  );
}

