"use client";

import { useEffect, useMemo, useState } from "react";

type Dashboard = any;

const DEFAULT_TEMPLATE = {
  key: "sow-custom-c1-es",
  name: "SOW Custom C1 (ES)",
  locale: "es",
  planTier: "C1",
  addonKeys: [],
  status: "DRAFT",
  description: "Template editable para propuestas SOW.",
  sections: [
    { key: "alcance", title: "Alcance", bodyTpl: "{{scope}}" },
    { key: "tiempos", title: "Tiempos", bodyTpl: "{{timeline}}" },
    { key: "costos", title: "Costos", bodyTpl: "{{costs}}\nTotal: {{pricingTotal}}" },
    { key: "exclusiones", title: "Exclusiones", bodyTpl: "{{exclusions}}" },
  ],
};

export default function ProposalBuilderPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [installationId, setInstallationId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateJson, setTemplateJson] = useState(JSON.stringify(DEFAULT_TEMPLATE, null, 2));
  const [planTier, setPlanTier] = useState("C1");
  const [addonKeysText, setAddonKeysText] = useState("");
  const [clientName, setClientName] = useState("");
  const [scope, setScope] = useState("Implementación base, setup de catálogo, configuración inicial y capacitación.");
  const [timeline, setTimeline] = useState("2 semanas: kickoff, configuración, validaciones, salida controlada.");
  const [costs, setCosts] = useState("Incluye PM, setup técnico, pruebas y handoff.");
  const [exclusions, setExclusions] = useState("No incluye desarrollo a medida fuera de add-ons aprobados.");
  const [currency, setCurrency] = useState("USD");
  const [baseAmount, setBaseAmount] = useState("499");
  const [discountPct, setDiscountPct] = useState("0");
  const [preview, setPreview] = useState<any>(null);
  const [generated, setGenerated] = useState<any>(null);

  async function reload() {
    const res = await fetch("/api/proposal-builder", { cache: "no-store" });
    const data = await res.json();
    setDashboard(data);
    if (!templateId && data?.templates?.[0]?.id) setTemplateId(String(data.templates[0].id));
  }

  useEffect(() => {
    reload().catch((e) => setStatusMsg(String(e?.message ?? "load_failed")));
  }, []);

  const templates = useMemo(() => dashboard?.templates ?? [], [dashboard]);
  const proposals = useMemo(() => dashboard?.proposals ?? [], [dashboard]);

  async function postAction(body: any) {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/proposal-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "request_failed"));
      setStatusMsg("OK");
      await reload();
      return data;
    } catch (error: any) {
      setStatusMsg(String(error?.message ?? "request_failed"));
      throw error;
    } finally {
      setLoading(false);
    }
  }

  function payloadBase() {
    return {
      installationId: installationId || null,
      templateId: templateId || null,
      planTier,
      addonKeys: addonKeysText.split(",").map((s) => s.trim()).filter(Boolean),
      clientName: clientName || null,
      variables: { scope, timeline, costs, exclusions, clientName },
      pricing: {
        currency,
        baseAmount: Number(baseAmount || 0),
        discountPct: Number(discountPct || 0),
        addonItems: addonKeysText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((key) => ({ key, label: key, amount: 0 })),
      },
    };
  }

  async function runPreview() {
    const data = await postAction({ action: "preview", ...payloadBase() });
    setPreview(data.result);
  }

  async function runGenerate() {
    const data = await postAction({ action: "generate", ...payloadBase() });
    setGenerated(data.result);
  }

  async function saveTemplate() {
    const parsed = JSON.parse(templateJson);
    await postAction({ action: "upsertTemplate", template: parsed });
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Proposal Builder</h1>
      <p>Templates SOW por plan/add-on, variables de alcance/tiempos/costos/exclusiones y export PDF firmado con evidencia.</p>
      {statusMsg ? <p><strong>Status:</strong> {statusMsg}</p> : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Templates SOW</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">(resolver por plan)</option>
            {templates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} [{t.status}] {t.planTier ? `(${t.planTier})` : ""}
              </option>
            ))}
          </select>
          <button type="button" disabled={loading} onClick={saveTemplate}>Guardar template JSON</button>
        </div>
        <textarea
          rows={14}
          value={templateJson}
          onChange={(e) => setTemplateJson(e.target.value)}
          style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
        />
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Propuesta</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 8 }}>
          <label>Installation ID<input value={installationId} onChange={(e) => setInstallationId(e.target.value)} /></label>
          <label>Cliente<input value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
          <label>Plan
            <select value={planTier} onChange={(e) => setPlanTier(e.target.value)}>
              {["C1", "C2", "C3"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>Add-ons (csv)<input value={addonKeysText} onChange={(e) => setAddonKeysText(e.target.value)} placeholder="andreani,afip_arca" /></label>
          <label>Moneda<input value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
          <label>Base amount<input value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} /></label>
          <label>Descuento %<input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></label>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label>Alcance<textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} /></label>
          <label>Tiempos<textarea rows={2} value={timeline} onChange={(e) => setTimeline(e.target.value)} /></label>
          <label>Costos<textarea rows={2} value={costs} onChange={(e) => setCosts(e.target.value)} /></label>
          <label>Exclusiones<textarea rows={2} value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" disabled={loading} onClick={runPreview}>Preview</button>
          <button type="button" disabled={loading} onClick={runGenerate}>Generar PDF firmado</button>
        </div>
      </section>

      {preview ? (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2>Preview</h2>
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(preview, null, 2)}</pre>
        </section>
      ) : null}

      {generated ? (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2>Export generado</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(generated, null, 2)}</pre>
          <div style={{ display: "flex", gap: 12 }}>
            <a href={generated.links?.pdf} target="_blank" rel="noreferrer">Descargar PDF</a>
            <a href={generated.links?.json} target="_blank" rel="noreferrer">Ver export JSON</a>
          </div>
        </section>
      ) : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Historial</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Fecha</th>
              <th style={{ textAlign: "left" }}>Cliente</th>
              <th style={{ textAlign: "left" }}>Plan</th>
              <th style={{ textAlign: "left" }}>Template</th>
              <th style={{ textAlign: "left" }}>Estado</th>
              <th style={{ textAlign: "left" }}>Export</th>
            </tr>
          </thead>
          <tbody>
            {proposals.slice(0, 50).map((p: any) => (
              <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{new Date(p.createdAt).toLocaleString()}</td>
                <td>{p.clientName ?? p.installation?.clientName ?? "-"}</td>
                <td>{p.planTier}</td>
                <td>{p.template?.name ?? p.template?.key ?? "-"}</td>
                <td>{p.status}</td>
                <td>
                  <a href={`/api/proposal-builder?proposalId=${p.id}&format=pdf`} target="_blank" rel="noreferrer">PDF</a>
                </td>
              </tr>
            ))}
            {proposals.length === 0 ? (
              <tr><td colSpan={6}>Sin propuestas.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}

