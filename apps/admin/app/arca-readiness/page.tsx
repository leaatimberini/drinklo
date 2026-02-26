"use client";

import { useMemo, useState } from "react";

type ChecklistItem = {
  key: string;
  label: string;
  category: "technical" | "fiscal";
  required: boolean;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  meta?: Record<string, unknown>;
};

type ChecklistResponse = {
  checkedAt: string;
  summary: { readiness: string; pass: number; warn: number; fail: number; total: number };
  arca: { environmentConfigured: string; environmentEffective: string; pointOfSale: number | null; cuit: string | null; selectedInvoiceTypes: string[] };
  items: ChecklistItem[];
};

export default function ArcaReadinessPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [invoiceTypes, setInvoiceTypes] = useState<string[]>(["B", "C"]);
  const [amountArs, setAmountArs] = useState("1234.56");
  const [pointOfSale, setPointOfSale] = useState("");
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [dryRun, setDryRun] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "checklist" | "dryrun" | "report">(null);

  const qs = useMemo(() => new URLSearchParams({ invoiceTypes: invoiceTypes.join(",") }).toString(), [invoiceTypes]);

  async function loadChecklist() {
    setLoading("checklist");
    setMessage(null);
    const res = await fetch(`${apiUrl}/billing/arca/readiness?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setMessage(payload.error ?? "No se pudo cargar checklist");
      return;
    }
    setChecklist(payload);
  }

  async function runDryRun() {
    setLoading("dryrun");
    setMessage(null);
    const body: any = { invoiceTypes, amountArs: Number(amountArs) };
    if (pointOfSale.trim()) body.pointOfSale = Number(pointOfSale);
    const res = await fetch(`${apiUrl}/billing/arca/readiness/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setMessage(payload.error ?? "Dry run fallido");
      return;
    }
    setDryRun(payload);
    setChecklist(payload.checklist ?? checklist);
  }

  async function generateReport() {
    setLoading("report");
    setMessage(null);
    const body: any = { invoiceTypes, amountArs: Number(amountArs), includeDryRun: true };
    if (pointOfSale.trim()) body.pointOfSale = Number(pointOfSale);
    const res = await fetch(`${apiUrl}/billing/arca/readiness/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setMessage(payload.error ?? "No se pudo generar reporte");
      return;
    }
    setReport(payload);
    setChecklist(payload.checklist ?? checklist);
    setDryRun(payload.dryRun ?? dryRun);
  }

  function toggleType(type: string) {
    setInvoiceTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type].sort()));
  }

  const grouped = useMemo(() => {
    const items = checklist?.items ?? [];
    return {
      fiscal: items.filter((i) => i.category === "fiscal"),
      technical: items.filter((i) => i.category === "technical"),
    };
  }, [checklist]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: 8 }}>Asistente ARCA Readiness</h1>
      <p>Checklist técnico/fiscal, validaciones automáticas, dry run en homologación y reporte PDF firmado.</p>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, background: "var(--card-bg)" }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr 1fr" }}>
          <label>
            Token JWT
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
          </label>
          <label>
            Monto dry-run (ARS)
            <input value={amountArs} onChange={(e) => setAmountArs(e.target.value)} />
          </label>
          <label>
            Punto de venta (opcional override)
            <input value={pointOfSale} onChange={(e) => setPointOfSale(e.target.value)} placeholder="usa settings.afipPointOfSale" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <strong>Tipos de comprobante:</strong>
          {(["A", "B", "C", "M"] as const).map((type) => (
            <label key={type} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={invoiceTypes.includes(type)} onChange={() => toggleType(type)} /> {type}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={loadChecklist} disabled={loading !== null}>{loading === "checklist" ? "Cargando..." : "Validar checklist"}</button>
          <button onClick={runDryRun} disabled={loading !== null}>{loading === "dryrun" ? "Ejecutando..." : "Dry run HOMO"}</button>
          <button onClick={generateReport} disabled={loading !== null}>{loading === "report" ? "Generando..." : "Generar reporte PDF firmado"}</button>
        </div>
        {message ? <p style={{ marginTop: 10 }}>{message}</p> : null}
      </section>

      {checklist ? (
        <section style={{ marginTop: 16, border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, background: "var(--card-bg)" }}>
          <h2 style={{ marginTop: 0 }}>Resumen readiness</h2>
          <p>
            Estado: <strong>{checklist.summary.readiness}</strong> · PASS {checklist.summary.pass} · WARN {checklist.summary.warn} · FAIL {checklist.summary.fail}
          </p>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            Entorno configurado: {checklist.arca.environmentConfigured} (efectivo: {checklist.arca.environmentEffective}) · CUIT: {checklist.arca.cuit ?? "-"} · PV: {checklist.arca.pointOfSale ?? "-"}
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            {(["fiscal", "technical"] as const).map((category) => (
              <div key={category} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
                <h3 style={{ marginTop: 0, textTransform: "capitalize" }}>{category}</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {(grouped[category] ?? []).map((item) => (
                    <div key={item.key} style={{ border: "1px solid #f1f5f9", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong>{item.label}</strong>
                        <span style={{ color: item.status === "PASS" ? "#166534" : item.status === "WARN" ? "#92400e" : "#b91c1c" }}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>{item.message}</div>
                      {item.meta ? <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, margin: 0 }}>{JSON.stringify(item.meta, null, 2)}</pre> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {dryRun ? (
        <section style={{ marginTop: 16, border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, background: "var(--card-bg)" }}>
          <h2 style={{ marginTop: 0 }}>Dry run homologación</h2>
          <p>
            Resultado: <strong>{dryRun.ok ? "OK" : "FAIL"}</strong> · modo {dryRun.mode ?? "HOMO"}
          </p>
          {dryRun.blocking ? <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(dryRun.blocking, null, 2)}</pre> : null}
          {Array.isArray(dryRun.cases) ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><th align="left">Tipo</th><th align="left">OK</th><th align="left">Resultado</th><th align="left">CAE/Error</th></tr>
              </thead>
              <tbody>
                {dryRun.cases.map((c: any, idx: number) => (
                  <tr key={`${c.type}-${idx}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td>{c.type}</td><td>{String(c.ok)}</td><td>{c.result ?? "-"}</td><td>{c.cae ?? c.error ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {report ? (
        <section style={{ marginTop: 16, border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, background: "var(--card-bg)" }}>
          <h2 style={{ marginTop: 0 }}>Reporte firmado</h2>
          <p><strong>Firma:</strong> {report.signatureAlgorithm} · {report.signature}</p>
          <p><strong>Payload hash:</strong> {report.payloadHash}</p>
          {report.signedUrl ? (
            <p><a href={report.signedUrl} target="_blank" rel="noreferrer">Descargar PDF</a></p>
          ) : null}
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(report.manifest, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}
