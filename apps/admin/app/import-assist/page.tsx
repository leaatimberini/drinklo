"use client";

import { useMemo, useState } from "react";

type ImportType = "products" | "variants" | "prices" | "stock" | "customers";
type Icp = "bebidas" | "kiosco" | "distribuidora";

type MappingSuggestionResponse = {
  ok: boolean;
  type: ImportType;
  icp: string;
  rawHeaders: string[];
  suggested: {
    mapping: Record<string, string | null>;
    unmappedHeaders: string[];
    fields: Array<{
      field: string;
      required: boolean;
      candidates: Array<{ sourceHeader: string; confidence: number; reason: string }>;
      suggestion: { sourceHeader: string; confidence: number; reason: string } | null;
    }>;
  };
  appliedMapping: Record<string, string | null>;
  templates: Array<{
    id: string;
    name: string;
    type: ImportType;
    icp: string;
    mapping: Record<string, string | null>;
    updatedAt: string;
  }>;
  report: {
    canImport: boolean;
    count: number;
    errors: Array<{ row: number; field?: string; message: string }>;
    previewRaw: Record<string, any>[];
    previewMapped: Record<string, any>[];
  };
};

type ImportRunResult = {
  ok: boolean;
  dryRun: boolean;
  count: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  preview: Record<string, any>[];
  mappingApplied?: Record<string, string | null> | null;
};

export default function ImportAssistPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [type, setType] = useState<ImportType>("products");
  const [icp, setIcp] = useState<Icp>("bebidas");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<MappingSuggestionResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [templateName, setTemplateName] = useState("Bebidas base");
  const [saveTemplateOnRun, setSaveTemplateOnRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState<ImportRunResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canonicalFields = useMemo(() => analysis?.suggested.fields ?? [], [analysis]);

  async function callAnalyze(customMapping?: Record<string, string | null>) {
    if (!file) {
      setMessage("Seleccioná un archivo CSV/XLSX.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setRunResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("icp", icp);
    if (customMapping && Object.keys(customMapping).length > 0) {
      form.append("columnMappingJson", JSON.stringify(customMapping));
    }
    const res = await fetch(`${apiUrl}/admin/import/assist/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as any;
    setLoading(false);
    if (!res.ok) {
      setMessage(payload.message ?? payload.error ?? "No se pudo analizar el archivo");
      return;
    }
    setAnalysis(payload as MappingSuggestionResponse);
    setMapping((payload.appliedMapping ?? payload.suggested?.mapping ?? {}) as Record<string, string | null>);
  }

  async function runImport(dryRun: boolean) {
    if (!file) {
      setMessage("Seleccioná un archivo CSV/XLSX.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("icp", icp);
    form.append("dryRun", String(dryRun));
    if (mapping && Object.keys(mapping).length > 0) {
      form.append("columnMappingJson", JSON.stringify(mapping));
    }
    if (saveTemplateOnRun && templateName.trim()) {
      form.append("saveMappingTemplate", "true");
      form.append("mappingTemplateName", templateName.trim());
    }
    const res = await fetch(`${apiUrl}/admin/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as any;
    setLoading(false);
    if (!res.ok) {
      setMessage(payload.message ?? payload.error ?? "No se pudo ejecutar import");
      return;
    }
    setRunResult(payload as ImportRunResult);
    if ((payload as ImportRunResult).ok && dryRun) {
      setMessage("Dry-run OK. Revisá preview y luego ejecutá importación real.");
    } else if ((payload as ImportRunResult).ok) {
      setMessage("Importación completada.");
    } else {
      setMessage("Se detectaron errores de validación.");
    }
    await callAnalyze(mapping);
  }

  async function saveTemplate() {
    if (!templateName.trim()) {
      setMessage("Ingresá nombre de template.");
      return;
    }
    const res = await fetch(`${apiUrl}/admin/import/assist/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        icp,
        name: templateName.trim(),
        mapping,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage((payload as any).message ?? "No se pudo guardar template");
      return;
    }
    setMessage("Template guardado.");
    await callAnalyze(mapping);
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`${apiUrl}/admin/import/assist/templates/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage((payload as any).message ?? "No se pudo borrar template");
      return;
    }
    setMessage("Template eliminado.");
    await callAnalyze(mapping);
  }

  const currentPreview = runResult?.preview?.length ? runResult.preview : analysis?.report.previewMapped ?? [];

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: 8 }}>Import asistido (CSV/XLSX)</h1>
      <p style={{ marginTop: 0 }}>
        Sugerencia de mapeo con heurística local (mock IA), preview, validación, dry-run y templates por ICP (bebidas).
      </p>

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 180px 180px", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6 }}>
          JWT token
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as ImportType)}>
            <option value="products">products</option>
            <option value="variants">variants</option>
            <option value="prices">prices</option>
            <option value="stock">stock</option>
            <option value="customers">customers</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          ICP
          <select value={icp} onChange={(e) => setIcp(e.target.value as Icp)}>
            <option value="bebidas">bebidas</option>
            <option value="kiosco">kiosco</option>
            <option value="distribuidora">distribuidora</option>
          </select>
        </label>
      </section>

      <section style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "1fr auto auto auto" }}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={() => callAnalyze()} disabled={loading || !file}>
          {loading ? "Analizando..." : "Analizar"}
        </button>
        <button onClick={() => runImport(true)} disabled={loading || !file}>
          Dry-run
        </button>
        <button onClick={() => runImport(false)} disabled={loading || !file}>
          Importar
        </button>
      </section>

      {message ? <p style={{ marginTop: 10 }}>{message}</p> : null}

      {analysis ? (
        <>
          <section
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--card-bg)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Templates de mapping</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 6 }}>
                Nombre template
                <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={saveTemplateOnRun} onChange={(e) => setSaveTemplateOnRun(e.target.checked)} />
                Guardar al ejecutar
              </label>
              <button onClick={saveTemplate}>Guardar template</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {(analysis.templates ?? []).length === 0 ? <p style={{ margin: 0 }}>Sin templates guardados.</p> : null}
              {(analysis.templates ?? []).map((tpl) => (
                <div key={tpl.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <strong>{tpl.name}</strong> <small>({tpl.icp})</small>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Actualizado: {new Date(tpl.updatedAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          setMapping(tpl.mapping);
                          setTemplateName(tpl.name);
                        }}
                      >
                        Usar
                      </button>
                      <button onClick={() => deleteTemplate(tpl.id)}>Borrar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--card-bg)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Mapping sugerido</h2>
            <p style={{ marginTop: 0 }}>
              Headers detectados: <code>{analysis.rawHeaders.join(" | ")}</code>
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Campo destino</th>
                    <th align="left">Requerido</th>
                    <th align="left">Columna origen</th>
                    <th align="left">Confianza</th>
                    <th align="left">Alternativas</th>
                  </tr>
                </thead>
                <tbody>
                  {canonicalFields.map((field) => {
                    const selectedHeader = mapping[field.field] ?? "";
                    const selectedCandidate = field.candidates.find((c) => c.sourceHeader === selectedHeader);
                    return (
                      <tr key={field.field} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "8px 0" }}>
                          <code>{field.field}</code>
                        </td>
                        <td>{field.required ? "Si" : "No"}</td>
                        <td>
                          <select
                            value={selectedHeader ?? ""}
                            onChange={(e) => {
                              const value = e.target.value || null;
                              setMapping((prev) => ({ ...prev, [field.field]: value }));
                            }}
                          >
                            <option value="">(sin mapear)</option>
                            {analysis.rawHeaders.map((header) => (
                              <option key={`${field.field}:${header}`} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{selectedCandidate ? `${Math.round(selectedCandidate.confidence * 100)}%` : "-"}</td>
                        <td style={{ fontSize: 12 }}>
                          {field.candidates.slice(0, 3).map((c) => `${c.sourceHeader} (${Math.round(c.confidence * 100)}%)`).join(", ") || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {analysis.suggested.unmappedHeaders.length ? (
              <p style={{ marginTop: 10 }}>
                Sin mapear: <code>{analysis.suggested.unmappedHeaders.join(", ")}</code>
              </p>
            ) : null}
          </section>

          <section
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--card-bg)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Reporte de validación</h2>
            <p style={{ marginTop: 0 }}>
              Filas: <strong>{analysis.report.count}</strong> | Estado:{" "}
              <strong>{analysis.report.canImport ? "Listo para importar" : "Con errores"}</strong>
            </p>
            {(runResult?.errors?.length || analysis.report.errors.length) > 0 ? (
              <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8, padding: 10 }}>
                <strong>Errores</strong>
                <ul style={{ margin: "8px 0 0 16px" }}>
                  {(runResult?.errors?.length ? runResult.errors : analysis.report.errors).slice(0, 20).map((e, idx) => (
                    <li key={`${e.row}:${e.field ?? "-"}:${idx}`}>
                      fila {e.row}
                      {e.field ? ` / ${e.field}` : ""}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ margin: 0 }}>Sin errores de validación.</p>
            )}

            <h3>Preview mapeado</h3>
            <pre
              style={{
                background: "#0f172a",
                color: "#e2e8f0",
                padding: 12,
                borderRadius: 8,
                overflowX: "auto",
                maxHeight: 320,
              }}
            >
              {JSON.stringify(currentPreview.slice(0, 10), null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </main>
  );
}

