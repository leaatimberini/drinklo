"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [campaign, setCampaign] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    domain: "",
    instanceId: "",
    utmSource: "",
    utmCampaign: "",
    referral: "",
    cuit: "",
    phone: "",
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get("trial") || "").trim().toUpperCase();
    setTrialCode(code);
    if (!code) return;
    fetch(`/api/signup?trial=${encodeURIComponent(code)}`)
      .then((r) => r.json().then((p) => ({ ok: r.ok, p })))
      .then(({ ok, p }) => {
        if (!ok) {
          setError(p.error ?? "invalid trial campaign");
          return;
        }
        setCampaign(p.campaign);
      })
      .catch((e) => setError(e.message));
  }, []);

  const fingerprint = useMemo(() => makeFingerprint(), []);

  async function submit() {
    setError(null);
    setResult(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trial: trialCode,
        ...form,
        fingerprint,
        landing: window.location.href,
      }),
    });
    const payload = await res.json().catch(() => ({}));
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
      <p>Alta pública con código de campaña de trial.</p>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {campaign ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p>
            <strong>Campaña:</strong> {campaign.code} · {campaign.tier}
          </p>
          <p>
            <strong>Duración:</strong> {campaign.durationDays} días ·{" "}
            <strong>Requiere aprobación:</strong> {campaign.requiresApproval ? "Sí" : "No"}
          </p>
          <p>
            <strong>Expira:</strong> {campaign.expiresAt ? new Date(campaign.expiresAt).toLocaleString() : "Sin fecha"}
          </p>
        </div>
      ) : null}

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <label>
          Código trial
          <input value={trialCode} onChange={(e) => setTrialCode(e.target.value.toUpperCase())} />
        </label>
        <label>
          Empresa
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </label>
        <label>
          Email
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Dominio
          <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </label>
        <label>
          Instance ID (opcional)
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
          CUIT (opcional)
          <input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
        </label>
        <label>
          Teléfono (opcional)
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <button onClick={submit}>Crear trial</button>
      </section>

      {result ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Resultado</h2>
          <pre style={{ background: "#f6f6f6", padding: 8 }}>{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

