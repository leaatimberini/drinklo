"use client";

import { useEffect, useState } from "react";

type Partner = { id: string; name: string; slug: string };
type Run = { id: string; partnerId: string; status: string; score: number; kitVersion: string; submittedAt: string };
type Cert = {
  id: string;
  partnerId: string;
  certificateNo: string;
  status: string;
  computedStatus?: string;
  issuedAt: string;
  expiresAt: string;
  partner?: Partner;
  run?: { id: string; score: number; status: string; kitVersion: string } | null;
};

export default function PartnerCertificationsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [runId, setRunId] = useState("");
  const [validityDays, setValidityDays] = useState("180");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [partnersRes, certsRes] = await Promise.all([
      fetch("/api/partners/admin"),
      fetch("/api/partners/admin/certifications"),
    ]);
    const partnersPayload = await partnersRes.json().catch(() => ({}));
    const certsPayload = await certsRes.json().catch(() => ({}));
    if (!partnersRes.ok) throw new Error(partnersPayload.error ?? "failed to load partners");
    if (!certsRes.ok) throw new Error(certsPayload.error ?? "failed to load certifications");
    setPartners((partnersPayload.partners ?? []) as Partner[]);
    setCerts((certsPayload.items ?? []) as Cert[]);

    const allRuns = ((partnersPayload.partners ?? []) as any[]).flatMap((p) =>
      Array.isArray(p.certificationRuns) ? p.certificationRuns : [],
    );
    const normalizedRuns: Run[] = allRuns
      .map((r: any) => ({
        id: r.id,
        partnerId: r.partnerId,
        status: r.status,
        score: r.score,
        kitVersion: r.kitVersion,
        submittedAt: r.submittedAt,
      }))
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    setRuns(normalizedRuns);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function issueCertification() {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/partners/admin/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId,
        runId,
        validityDays: Number(validityDays),
        issuedBy: "control-plane-admin",
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to issue certification");
      return;
    }
    setMessage(`Certificación emitida: ${payload.certification?.certificateNo ?? payload.certification?.id}`);
    await load();
  }

  return (
    <main>
      <h1>Partner Certification</h1>
      <p>Emisión y seguimiento de certificaciones de partners técnicos.</p>
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Emitir certificación</h2>
        <label>
          Partner
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Seleccionar</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </label>
        <label>
          Run (PASSED)
          <select value={runId} onChange={(e) => setRunId(e.target.value)}>
            <option value="">Seleccionar</option>
            {runs
              .filter((r) => r.status === "PASSED" && (!partnerId || r.partnerId === partnerId))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 8)} · score {r.score} · {r.kitVersion}
                </option>
              ))}
          </select>
        </label>
        <label>
          Validez (días)
          <input value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
        </label>
        <button onClick={issueCertification}>Emitir</button>
      </section>

      <section className="card">
        <h2>Certificaciones emitidas</h2>
        {certs.map((c) => (
          <div key={c.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{c.certificateNo}</strong> · {c.partner?.name ?? c.partnerId} · {c.computedStatus ?? c.status}
            <div>
              emitida {new Date(c.issuedAt).toLocaleString()} · vence {new Date(c.expiresAt).toLocaleDateString()}
            </div>
            {c.run ? <div>run: {c.run.id.slice(0, 8)} · score {c.run.score}</div> : null}
          </div>
        ))}
        {certs.length === 0 ? <p>Sin certificaciones.</p> : null}
      </section>
    </main>
  );
}

