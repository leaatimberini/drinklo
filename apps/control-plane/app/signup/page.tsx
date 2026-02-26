"use client";

import { useEffect, useMemo, useState } from "react";

type TrialCampaignPreview = {
  code: string;
  tier: string;
  durationDays: number;
  expiresAt?: string | null;
  requiresApproval?: boolean;
};

type SignupLegalDoc = {
  type: "TOS" | "PRIVACY";
  version: string;
  locale: string;
  title: string;
  effectiveAt: string;
  content: string;
};

function makeFingerprint() {
  if (typeof window === "undefined") return "";
  const raw = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(new Date().getTimezoneOffset()),
  ].join("|");
  return btoa(unescape(encodeURIComponent(raw))).slice(0, 200);
}

export default function SignupPage() {
  const [trialCode, setTrialCode] = useState("");
  const [campaign, setCampaign] = useState<TrialCampaignPreview | null>(null);
  const [legalDocs, setLegalDocs] = useState<SignupLegalDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    domain: "",
    instanceId: "",
    utmSource: "",
    utmCampaign: "",
    referral: "",
    businessType: "kiosco",
    cuit: "",
    phone: "",
    acceptTos: false,
    acceptPrivacy: false,
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get("trial") || "").trim().toUpperCase();
    setTrialCode(code);
    fetch("/api/legal-clickwrap/public/signup-docs?locale=es")
      .then((r) => r.json())
      .then((p) => setLegalDocs(Array.isArray(p.documents) ? (p.documents as SignupLegalDoc[]) : []))
      .catch(() => undefined);
    if (!code) return;
    fetch(`/api/signup?trial=${encodeURIComponent(code)}`)
      .then((r) => r.json().then((p) => ({ ok: r.ok, p })))
      .then(({ ok, p }) => {
        if (!ok) {
          setError(p.error ?? "invalid trial campaign");
          return;
        }
        setCampaign(p.campaign as TrialCampaignPreview);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const fingerprint = useMemo(() => makeFingerprint(), []);
  const canSubmit =
    Boolean(trialCode.trim()) &&
    Boolean(form.companyName.trim()) &&
    Boolean(form.email.trim()) &&
    form.acceptTos &&
    form.acceptPrivacy;

  async function submit() {
    setError(null);
    setResult(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trial: trialCode,
        ...form,
        locale: "es",
        fingerprint,
        landing: window.location.href,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "signup failed");
      setResult(payload);
      return;
    }
    setResult(payload);
  }

  return (
    <main>
      <h1>Signup Trial</h1>
      <p>Public signup with trial campaign code and mandatory clickwrap (TOS + Privacy).</p>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {campaign ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p>
            <strong>Campaign:</strong> {campaign.code} - {campaign.tier}
          </p>
          <p>
            <strong>Duration:</strong> {campaign.durationDays} days - <strong>Approval required:</strong>{" "}
            {campaign.requiresApproval ? "Yes" : "No"}
          </p>
          <p>
            <strong>Expires:</strong> {campaign.expiresAt ? new Date(campaign.expiresAt).toLocaleString() : "No date"}
          </p>
        </div>
      ) : null}

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <label>
          Trial code
          <input value={trialCode} onChange={(e) => setTrialCode(e.target.value.toUpperCase())} />
        </label>
        <label>
          Company
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </label>
        <label>
          Email
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Domain
          <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </label>
        <label>
          Instance ID (optional)
          <input value={form.instanceId} onChange={(e) => setForm({ ...form, instanceId: e.target.value })} />
        </label>
        <label>
          UTM Source
          <input value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: e.target.value })} />
        </label>
        <label>
          UTM Campaign
          <input value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })} />
        </label>
        <label>
          Referral
          <input value={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.value })} />
        </label>
        <label>
          Business type (ICP)
          <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
            <option value="kiosco">kiosco</option>
            <option value="distribuidora">distribuidora</option>
            <option value="almacen">almacen</option>
            <option value="supermercado">supermercado</option>
            <option value="otros">otros</option>
          </select>
        </label>
        <label>
          CUIT (optional)
          <input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
        </label>
        <label>
          Phone (optional)
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>

        <div className="card" style={{ background: "#fafafa" }}>
          <h3 style={{ marginTop: 0 }}>Required legal acceptance</h3>
          {legalDocs.map((doc) => {
            const checked = doc.type === "TOS" ? form.acceptTos : form.acceptPrivacy;
            const toggle = (value: boolean) =>
              setForm((prev) => ({
                ...prev,
                [doc.type === "TOS" ? "acceptTos" : "acceptPrivacy"]: value,
              }));
            return (
              <label key={`${doc.type}:${doc.version}`} style={{ display: "grid", gap: 4, marginBottom: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} />
                  I accept {doc.title} ({doc.type}) {doc.version}
                </span>
                <small style={{ color: "#666" }}>
                  Effective: {new Date(doc.effectiveAt).toLocaleDateString()} - {doc.content}
                </small>
              </label>
            );
          })}
          {legalDocs.length === 0 ? <small style={{ color: "#666" }}>Loading legal documents...</small> : null}
          <small style={{ color: "#666" }}>
            Marketing consent is separate and optional (managed in marketing-site lead capture).
          </small>
        </div>

        <button disabled={!canSubmit} onClick={submit}>
          Create trial
        </button>
      </section>

      {result ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Result</h2>
          <pre style={{ background: "#f6f6f6", padding: 8 }}>{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}
