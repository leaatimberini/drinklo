"use client";

import { useMemo, useState } from "react";

type Props = {
  partnerSlug: string;
  token: string;
  defaultReportJson: string;
};

export function PartnerCertificationSection(props: Props) {
  const [reportJson, setReportJson] = useState(props.defaultReportJson);
  const [signature, setSignature] = useState("");
  const [kit, setKit] = useState<any | null>(null);
  const [response, setResponse] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hintCommand = useMemo(
    () => `node -e "const c=require('crypto');const r=${JSON.stringify(props.defaultReportJson)};console.log(c.createHmac('sha256','<PORTAL_TOKEN>').update(r).digest('hex'))"`,
    [props.defaultReportJson],
  );

  async function loadKit() {
    setError(null);
    const res = await fetch(
      `/api/partners/portal/certification-kit?partner=${encodeURIComponent(props.partnerSlug)}&token=${encodeURIComponent(props.token)}`,
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to load certification kit");
      return;
    }
    setKit(payload.kit);
  }

  async function submitRun() {
    setLoading(true);
    setError(null);
    setResponse(null);
    let report: any;
    try {
      report = JSON.parse(reportJson);
    } catch {
      setLoading(false);
      setError("Report JSON inválido / invalid JSON");
      return;
    }
    const res = await fetch("/api/partners/portal/certification-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partner: props.partnerSlug,
        token: props.token,
        report,
        signature,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? "submission failed");
      return;
    }
    setResponse(payload);
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Certification Test Kit</h2>
      <p>Descargá el kit, ejecutá pruebas contractuales/sandbox y subí resultados firmados.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button type="button" onClick={loadKit}>Cargar kit</button>
        <button type="button" onClick={submitRun} disabled={loading}>
          {loading ? "Enviando..." : "Subir resultados firmados"}
        </button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {response ? (
        <pre style={{ background: "#f6f6f6", padding: 8 }}>{JSON.stringify(response, null, 2)}</pre>
      ) : null}

      {kit ? (
        <details style={{ marginBottom: 12 }}>
          <summary>Kit (JSON)</summary>
          <pre style={{ background: "#f6f6f6", padding: 8 }}>{JSON.stringify(kit, null, 2)}</pre>
        </details>
      ) : null}

      <label>
        Report JSON (signed payload)
        <textarea rows={14} value={reportJson} onChange={(e) => setReportJson(e.target.value)} />
      </label>
      <label>
        Signature (HMAC-SHA256 con portal token)
        <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="hex signature" />
      </label>
      <details>
        <summary>Helper de firma (ejemplo)</summary>
        <pre style={{ background: "#f6f6f6", padding: 8, whiteSpace: "pre-wrap" }}>{hintCommand}</pre>
      </details>
    </section>
  );
}

