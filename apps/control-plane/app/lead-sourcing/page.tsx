"use client";

import { useState } from "react";

type LeadPreview = {
  rowNumber: number;
  empresa: string;
  rubro: string;
  ciudad: string;
  contacto: string;
  canal: string;
  email: string | null;
  phone: string | null;
  contactName?: string | null;
  dedupeKey: string;
  tags: string[];
  potentialScore: number;
  potentialBand: "LOW" | "MEDIUM" | "HIGH";
  recommendedStage: string;
  recommendedTasks: string[];
  warnings: string[];
};

export default function LeadSourcingPage() {
  const [token, setToken] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [importsHistory, setImportsHistory] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [recentDeals, setRecentDeals] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cpFetch(path: string, init?: RequestInit) {
    return fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        "x-cp-admin-token": token,
      },
    });
  }

  async function loadHistory() {
    const res = await cpFetch("/api/lead-sourcing");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage((payload as any).error ?? "No se pudo cargar historial");
      return;
    }
    setImportsHistory((payload as any).imports ?? []);
    setRecentLeads((payload as any).recentLeads ?? []);
    setRecentDeals((payload as any).recentDeals ?? []);
  }

  async function postMultipart(action: "analyze" | "import", dryRun = false) {
    if (!file) {
      setMessage("Seleccioná un CSV.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    form.append("action", action);
    if (action === "import") form.append("dryRun", String(dryRun));
    const res = await cpFetch("/api/lead-sourcing", { method: "POST", body: form });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage((payload as any).error ?? `No se pudo ${action}`);
      return;
    }
    setAnalysis(payload);
    if (action === "import") {
      setMessage(dryRun ? "Dry-run completado." : "Importación aplicada y sincronizada con CRM.");
      await loadHistory();
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1280 }}>
      <h1 style={{ marginTop: 0 }}>Lead Sourcing</h1>
      <p style={{ marginTop: 0 }}>
        Importá leads CSV, aplicá enrichment (dedupe + ICP tags + score), sincronizá con CRM y creá tareas automáticas.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          Control-plane admin token
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="CONTROL_PLANE_ADMIN_TOKEN" />
        </label>
        <button onClick={loadHistory} disabled={!token || loading}>
          Cargar historial
        </button>
      </section>

      <section style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "end" }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={() => postMultipart("analyze")} disabled={!file || !token || loading}>
          {loading ? "Procesando..." : "Analizar CSV"}
        </button>
        <button onClick={() => postMultipart("import", true)} disabled={!file || !token || loading}>
          Dry-run import
        </button>
        <button onClick={() => postMultipart("import", false)} disabled={!file || !token || loading}>
          Importar + CRM
        </button>
      </section>

      {message ? <p style={{ marginTop: 10 }}>{message}</p> : null}

      {analysis ? (
        <section style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Preview / Reporte</h2>
          <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(analysis.summary ?? {}, null, 2)}
          </pre>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr>
                  <th align="left">Fila</th>
                  <th align="left">Empresa</th>
                  <th align="left">Contacto</th>
                  <th align="left">ICP / Tags</th>
                  <th align="left">Score</th>
                  <th align="left">Stage</th>
                  <th align="left">Tareas auto</th>
                </tr>
              </thead>
              <tbody>
                {((analysis.preview ?? []) as LeadPreview[]).map((row) => (
                  <tr key={`${row.rowNumber}-${row.dedupeKey}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <strong>{row.empresa || "(sin empresa)"}</strong>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{row.ciudad || "-"} · {row.canal || "-"}</div>
                    </td>
                    <td>
                      {row.contactName || row.contacto || "-"}
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{row.email || row.phone || "sin email/teléfono"}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{(row.tags ?? []).slice(0, 6).join(", ")}</td>
                    <td>
                      {row.potentialScore} <small>({row.potentialBand})</small>
                      {row.warnings?.length ? <div style={{ fontSize: 12, color: "#b45309" }}>{row.warnings.join(", ")}</div> : null}
                    </td>
                    <td>{row.recommendedStage}</td>
                    <td style={{ fontSize: 12 }}>{(row.recommendedTasks ?? []).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Historial imports</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {importsHistory.map((item) => (
              <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                <div><strong>{new Date(item.capturedAt).toLocaleString()}</strong> · {item.capturedBy || "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>hash: <code>{item.payloadHash}</code></div>
                <pre style={{ margin: "6px 0 0", fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(item.summary ?? {}, null, 2)}</pre>
              </div>
            ))}
            {importsHistory.length === 0 ? <p style={{ margin: 0 }}>Sin imports todavía.</p> : null}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>CRM (últimos creados/actualizados)</h2>
          <h3 style={{ fontSize: 15 }}>Leads</h3>
          <ul style={{ paddingLeft: 16 }}>
            {recentLeads.map((lead) => (
              <li key={lead.id}>
                {lead.companyName || lead.email} · {lead.businessType || "-"} · {lead.city || "-"}
              </li>
            ))}
          </ul>
          <h3 style={{ fontSize: 15 }}>Deals</h3>
          <ul style={{ paddingLeft: 16 }}>
            {recentDeals.map((deal) => (
              <li key={deal.id}>
                {deal.title} · {deal.stage} · {deal.lead?.companyName || deal.lead?.email || "-"}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
