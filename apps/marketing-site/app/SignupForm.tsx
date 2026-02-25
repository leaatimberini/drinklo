"use client";

import { useMemo, useState } from "react";
import { trackMarketingEvent } from "./lib/analytics";

type Props = {
  trialCode?: string | null;
  utm: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    referral?: string;
  };
};

export function SignupForm({ trialCode, utm }: Props) {
  const [form, setForm] = useState({
    email: "",
    businessType: "kiosco",
    city: "",
    companyName: "",
    domain: "",
    consentMarketing: false,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modeLabel = useMemo(() => (trialCode ? `Trial con código ${trialCode}` : "Captura de lead"), [trialCode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    trackMarketingEvent("lead_submit", { trialCode: trialCode ?? null, businessType: form.businessType });

    const endpoint = "/api/signup";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        trial: trialCode || undefined,
        ...utm,
      }),
    }).catch(() => null);

    setLoading(false);
    if (!res) {
      setError("No se pudo conectar con el backend.");
      return;
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "No se pudo procesar la solicitud");
      trackMarketingEvent("lead_submit_error", { status: res.status, error: payload.error ?? "unknown" });
      return;
    }
    setResult(payload);
    trackMarketingEvent("lead_submit_success", {
      mode: payload.mode ?? (trialCode ? "trial_signup" : "lead_only"),
      trialCode: trialCode ?? null,
    });
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ marginTop: 16 }}>
      <div>
        <div className="badge">{modeLabel}</div>
        <h2 className="section-title" style={{ marginTop: 10 }}>
          {trialCode ? "Probar 30 días" : "Hablemos de tu operación"}
        </h2>
        <div className="muted">
          {trialCode
            ? "Completa tus datos para activar el trial de la campaña."
            : "Dejanos tus datos y te contactamos con demo y propuesta según tu tipo de negocio."}
        </div>
      </div>

      <label className="field">
        Email
        <input
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="dueño@negocio.com"
        />
      </label>

      <div className="grid-3">
        <label className="field">
          Tipo de negocio
          <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
            <option value="kiosco">Kiosco / Retail</option>
            <option value="distribuidora">Distribuidora</option>
            <option value="bar">Bar / Gastronomía</option>
          </select>
        </label>
        <label className="field">
          Ciudad
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="CABA" required />
        </label>
        <label className="field">
          Empresa (opcional)
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </label>
      </div>

      <label className="field">
        Dominio (opcional)
        <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="miempresa.com" />
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={form.consentMarketing}
          onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })}
        />
        Consentimiento marketing (separado del alta/trial)
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Enviando..." : trialCode ? "Activar trial" : "Enviar lead"}
        </button>
      </div>

      {error ? <div style={{ color: "var(--danger)" }}>{error}</div> : null}
      {result ? (
        <div className="card" style={{ borderColor: "rgba(77,226,197,0.35)" }}>
          <strong>Solicitud procesada</strong>
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </form>
  );
}
