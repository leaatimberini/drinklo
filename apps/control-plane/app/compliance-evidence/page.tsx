"use client";

import { useEffect, useState } from "react";

type Control = {
  id: string;
  key: string;
  domain: string;
  title: string;
  status: string;
  description: string;
};

type Evidence = {
  id: string;
  evidenceType: string;
  source: string;
  payloadHash: string;
  capturedAt: string;
  sourceCapturedAt: string;
  control?: { key: string; domain: string; title: string; status: string } | null;
};

export default function ComplianceEvidencePage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [controlsRes, evidenceRes] = await Promise.all([
      fetch("/api/compliance/controls"),
      fetch("/api/compliance/evidence?limit=200"),
    ]);

    if (!controlsRes.ok || !evidenceRes.ok) {
      throw new Error("failed to load compliance evidence");
    }

    setControls(await controlsRes.json());
    setEvidence(await evidenceRes.json());
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function collectEvidence() {
    setMessage(null);
    setError(null);
    const response = await fetch("/api/compliance/evidence/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "control-plane-admin" }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "collect failed");
      return;
    }

    setMessage(`Evidence collected: ${payload.count}`);
    await load();
  }

  async function exportPackage() {
    setMessage(null);
    setError(null);
    const response = await fetch("/api/compliance/audit-package");
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "export failed");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "soc2-audit-package.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setMessage("Audit package exported");
  }

  return (
    <main>
      <h1>Compliance Evidence</h1>
      <p>SOC2-readiness evidence collection (no certification claim).</p>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Actions</h2>
        <button onClick={collectEvidence}>Collect Evidence</button>
        <button onClick={exportPackage} style={{ marginLeft: 8 }}>Export Signed Audit Package</button>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Control Mapping</h2>
        {controls.map((control) => (
          <div key={control.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{control.key}</strong> [{control.domain}] - {control.title}
            <div>{control.description}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Evidence</h2>
        {evidence.length === 0 && <p>No evidence collected yet.</p>}
        {evidence.map((item) => (
          <details key={item.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <summary>
              {item.control?.key ?? "UNMAPPED"} - {item.evidenceType} - {new Date(item.capturedAt).toLocaleString()}
            </summary>
            <p>Source: {item.source}</p>
            <p>Hash: <code>{item.payloadHash}</code></p>
            <p>Source captured: {new Date(item.sourceCapturedAt).toLocaleString()}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
