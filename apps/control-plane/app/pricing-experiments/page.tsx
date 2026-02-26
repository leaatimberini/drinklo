"use client";

import { useEffect, useMemo, useState } from "react";

type Experiment = {
  id: string;
  key: string;
  name: string;
  status: string;
  targetTier: string;
  variants: Array<{ id: string; key: string; name: string; weight: number; isControl: boolean; config: any }>;
};

type DashboardPayload = {
  experiments: Experiment[];
  assignments: Array<any>;
  results: {
    totals: { experiments: number; assignments: number; converted: number; paidRevenue: number };
    variants: Array<{
      experimentId: string;
      experimentKey: string;
      variantKey: string;
      variantName: string;
      assigned: number;
      accounts: number;
      converted: number;
      conversionRate: number;
      arpa: number;
      earlyChurnRate: number;
      paidRevenue: number;
      pastDue: number;
      restricted: number;
    }>;
  };
};

const defaultDraft = {
  key: "c1-offer-20-3m",
  name: "C1 offer 20% x 3m",
  status: "DRAFT",
  targetTier: "C1",
  billingPeriod: "MONTHLY",
  currencies: ["USD", "ARS"],
  trialCampaignCodes: [],
  icpFilters: [],
  variants: [
    { key: "control", name: "Control", weight: 50, isControl: true, config: {} },
    { key: "offer20", name: "20% off 3 meses", weight: 50, isControl: false, config: { offer: { percentOff: 20, billingCycles: 3, expiresDays: 120, label: "20% OFF x 3 meses" } } },
  ],
};

export default function PricingExperimentsPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(defaultDraft, null, 2));
  const [previewInput, setPreviewInput] = useState({ targetTier: "C1", emailDomain: "demo.com", cookieId: "cookie-123", trialCode: "" });
  const [previewResult, setPreviewResult] = useState<any>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/pricing-experiments", { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(payload.error ?? "No se pudo cargar pricing experiments");
      return;
    }
    setData(payload);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveExperiment() {
    setMessage(null);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch {
      setMessage("JSON inválido");
      return;
    }
    const res = await fetch("/api/pricing-experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", ...parsed }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(payload.error ?? "No se pudo guardar experimento");
      return;
    }
    setMessage(`Experimento guardado: ${payload.experiment?.key ?? "ok"}`);
    await load();
  }

  async function previewAssign() {
    const res = await fetch("/api/pricing-experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview_assign", ...previewInput }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(payload.error ?? "Preview falló");
      return;
    }
    setPreviewResult(payload.assignments ?? []);
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/pricing-experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", id, status }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(payload.error ?? "No se pudo cambiar estado");
      return;
    }
    setMessage(`Estado actualizado a ${status}`);
    await load();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of data?.results?.variants ?? []) {
      const list = map.get(row.experimentId) ?? [];
      list.push(row);
      map.set(row.experimentId, list);
    }
    return map;
  }, [data]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ marginBottom: 8 }}>Pricing Experiments</h1>
      <p>Experimentos de pricing/ofertas para trials y conversiones. Incluye asignación estable, métricas y aplicación de ofertas.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={load} disabled={loading}>{loading ? "Cargando..." : "Actualizar"}</button>
        {message ? <span>{message}</span> : null}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Nuevo / editar experimento (JSON)</h2>
        <textarea value={jsonDraft} onChange={(e) => setJsonDraft(e.target.value)} style={{ width: "100%", minHeight: 260, fontFamily: "monospace" }} />
        <div style={{ marginTop: 8 }}><button onClick={saveExperiment}>Guardar experimento</button></div>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Preview de asignación estable</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <input value={previewInput.targetTier} onChange={(e) => setPreviewInput({ ...previewInput, targetTier: e.target.value.toUpperCase() })} placeholder="C1" />
          <input value={previewInput.emailDomain} onChange={(e) => setPreviewInput({ ...previewInput, emailDomain: e.target.value })} placeholder="email domain" />
          <input value={previewInput.cookieId} onChange={(e) => setPreviewInput({ ...previewInput, cookieId: e.target.value })} placeholder="cookie id" />
          <input value={previewInput.trialCode} onChange={(e) => setPreviewInput({ ...previewInput, trialCode: e.target.value.toUpperCase() })} placeholder="trial code" />
        </div>
        <div style={{ marginTop: 8 }}><button onClick={previewAssign}>Preview</button></div>
        {previewResult ? <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(previewResult, null, 2)}</pre> : null}
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff", marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Resultados</h2>
        <p>
          Experimentos: <strong>{data?.results?.totals?.experiments ?? 0}</strong> · Assignments: <strong>{data?.results?.totals?.assignments ?? 0}</strong> · Converted: <strong>{data?.results?.totals?.converted ?? 0}</strong> · Paid revenue: <strong>{data?.results?.totals?.paidRevenue ?? 0}</strong>
        </p>
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {(data?.experiments ?? []).map((exp) => (
          <section key={exp.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong>{exp.name}</strong> <code>{exp.key}</code>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Tier {exp.targetTier} · estado {exp.status}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as const).map((status) => (
                  <button key={status} disabled={exp.status === status} onClick={() => setStatus(exp.id, status)}>{status}</button>
                ))}
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 13 }}>
              <thead>
                <tr>
                  <th align="left">Variant</th>
                  <th align="right">Weight</th>
                  <th align="right">Assigned</th>
                  <th align="right">Accounts</th>
                  <th align="right">Conv %</th>
                  <th align="right">ARPA</th>
                  <th align="right">Early churn %</th>
                  <th align="right">Past due</th>
                  <th align="right">Restricted</th>
                </tr>
              </thead>
              <tbody>
                {(grouped.get(exp.id) ?? []).map((row) => {
                  const variant = exp.variants.find((v) => v.id === row.variantId);
                  return (
                    <tr key={row.variantId} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 0" }}>
                        <div>{row.variantName} ({row.variantKey})</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{JSON.stringify(variant?.config ?? {})}</div>
                      </td>
                      <td align="right">{variant?.weight ?? "-"}</td>
                      <td align="right">{row.assigned}</td>
                      <td align="right">{row.accounts}</td>
                      <td align="right">{row.conversionRate}</td>
                      <td align="right">{row.arpa}</td>
                      <td align="right">{row.earlyChurnRate}</td>
                      <td align="right">{row.pastDue}</td>
                      <td align="right">{row.restricted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}
