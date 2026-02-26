"use client";

import { useEffect, useMemo, useState } from "react";
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

type SignupLegalDoc = {
  type: "TOS" | "PRIVACY";
  version: string;
  locale: string;
  title: string;
  effectiveAt: string;
  content: string;
};

export function SignupForm({ trialCode, utm }: Props) {
  const [form, setForm] = useState({
    email: "",
    businessType: "kiosco",
    city: "",
    companyName: "",
    domain: "",
    consentMarketing: false,
    acceptTos: false,
    acceptPrivacy: false,
  });
  const [legalDocs, setLegalDocs] = useState<SignupLegalDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/legal-docs?locale=es")
      .then((res) => res.json())
      .then((payload) => {
        if (Array.isArray(payload.documents)) setLegalDocs(payload.documents as SignupLegalDoc[]);
      })
      .catch(() => undefined);
  }, []);

  const modeLabel = useMemo(() => (trialCode ? `Trial code ${trialCode}` : "Lead capture"), [trialCode]);
  const canSubmit = !trialCode || (form.acceptTos && form.acceptPrivacy);

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
        locale: "es",
        trial: trialCode || undefined,
        ...utm,
      }),
    }).catch(() => null);

    setLoading(false);
    if (!res) {
      setError("Could not reach backend.");
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not process request");
      trackMarketingEvent("lead_submit_error", { status: res.status, error: payload.error ?? "unknown" });
      return;
    }
    setResult(payload);
    trackMarketingEvent("lead_submit_success", {
      mode: (payload.mode as string | undefined) ?? (trialCode ? "trial_signup" : "lead_only"),
      trialCode: trialCode ?? null,
    });
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ marginTop: 16 }}>
      <div>
        <div className="badge">{modeLabel}</div>
        <h2 className="section-title" style={{ marginTop: 10 }}>
          {trialCode ? "Start your 30-day trial" : "Tell us about your beverage operation"}
        </h2>
        <div className="muted">
          {trialCode
            ? "Complete your data to activate the campaign trial."
            : "Share your details and we will contact you with a demo and proposal by business type."}
        </div>
      </div>

      <label className="field">
        Email
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@shop.com" />
      </label>

      <div className="grid-3">
        <label className="field">
          Business type
          <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
            <option value="kiosco">Kiosk / Retail</option>
            <option value="distribuidora">Distributor</option>
            <option value="bar">Bar / Hospitality</option>
          </select>
        </label>
        <label className="field">
          City
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="CABA" required />
        </label>
        <label className="field">
          Company (optional)
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </label>
      </div>

      <label className="field">
        Domain (optional)
        <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="company.com" />
      </label>

      {trialCode ? (
        <div className="card" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
          <strong>Required legal acceptance for trial</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            Trial requires accepting TOS and Privacy. Marketing consent remains separate.
          </div>
          {legalDocs.map((doc) => {
            const field: "acceptTos" | "acceptPrivacy" = doc.type === "TOS" ? "acceptTos" : "acceptPrivacy";
            return (
              <label key={`${doc.type}:${doc.version}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={Boolean(form[field])}
                  onChange={(e) => setForm({ ...form, [field]: e.target.checked })}
                />
                <span>
                  I accept {doc.title} ({doc.version})
                  <span className="muted" style={{ display: "block" }}>
                    Effective {new Date(doc.effectiveAt).toLocaleDateString()} - {doc.content}
                  </span>
                </span>
              </label>
            );
          })}
          {legalDocs.length === 0 ? <div className="muted" style={{ marginTop: 10 }}>Loading legal documents...</div> : null}
        </div>
      ) : null}

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={form.consentMarketing} onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })} />
        Marketing consent (separate from trial signup)
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn primary" type="submit" disabled={loading || !canSubmit}>
          {loading ? "Sending..." : trialCode ? "Activate trial" : "Send lead"}
        </button>
      </div>

      {error ? <div style={{ color: "var(--danger)" }}>{error}</div> : null}
      {result ? (
        <div className="card" style={{ borderColor: "rgba(77,226,197,0.35)" }}>
          <strong>Request processed</strong>
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </form>
  );
}
