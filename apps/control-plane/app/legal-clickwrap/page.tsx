"use client";

import { useState } from "react";

type AnyObj = Record<string, unknown>;

export default function LegalClickwrapPage() {
  const [instanceId, setInstanceId] = useState("");
  const [userId, setUserId] = useState("admin@company");
  const [locale, setLocale] = useState("es");
  const [acceptDpa, setAcceptDpa] = useState(true);
  const [acceptSla, setAcceptSla] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<AnyObj[]>([]);
  const [acceptances, setAcceptances] = useState<AnyObj[]>([]);
  const [docForm, setDocForm] = useState({
    type: "TOS",
    version: "v1.0.0",
    locale: "es",
    title: "",
    content: "",
    effectiveAt: "",
  });

  async function loadDocuments() {
    setMessage(null);
    const res = await fetch(`/api/legal-clickwrap/admin?kind=documents&locale=${encodeURIComponent(locale)}`);
    const payload = (await res.json().catch(() => ({}))) as { error?: string; documents?: AnyObj[] };
    if (!res.ok) return setMessage(payload.error ?? "load_failed");
    setDocuments(payload.documents ?? []);
  }

  async function loadAcceptances() {
    if (!instanceId.trim()) return setMessage("instanceId required");
    setMessage(null);
    const res = await fetch(`/api/legal-clickwrap/admin?kind=acceptances&instanceId=${encodeURIComponent(instanceId.trim())}`);
    const payload = (await res.json().catch(() => ({}))) as { error?: string; acceptances?: AnyObj[] };
    if (!res.ok) return setMessage(payload.error ?? "load_failed");
    setAcceptances(payload.acceptances ?? []);
  }

  async function upsertDocument() {
    setMessage(null);
    const res = await fetch("/api/legal-clickwrap/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsertDocument",
        document: {
          ...docForm,
          effectiveAt: docForm.effectiveAt || undefined,
        },
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setMessage(payload.error ?? "upsert_failed");
    setMessage("Documento legal guardado.");
    await loadDocuments();
  }

  async function acceptEnterprise() {
    if (!instanceId.trim()) return setMessage("instanceId required");
    setMessage(null);
    const res = await fetch("/api/legal-clickwrap/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "acceptEnterprise",
        instanceId: instanceId.trim(),
        userId: userId.trim(),
        locale,
        dpa: acceptDpa,
        sla: acceptSla,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setMessage(payload.error ?? "accept_failed");
    setMessage("Aceptaciones DPA/SLA registradas.");
    await loadAcceptances();
  }

  async function downloadEvidencePack() {
    if (!instanceId.trim()) return setMessage("instanceId required");
    setMessage(null);
    const res = await fetch("/api/legal-clickwrap/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "evidencePack", instanceId: instanceId.trim() }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return setMessage(payload.error ?? "evidence_pack_failed");
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] ?? `legal-clickwrap-${instanceId.trim()}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Evidence pack generado.");
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section>
        <h1>Legal Clickwrap</h1>
        <p>Manage versioned legal documents and record enterprise DPA/SLA acceptances.</p>
      </section>

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Document Catalog</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          <label>
            Type
            <select value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
              <option value="TOS">TOS</option>
              <option value="PRIVACY">PRIVACY</option>
              <option value="DPA">DPA</option>
              <option value="SLA">SLA</option>
            </select>
          </label>
          <label>
            Version
            <input value={docForm.version} onChange={(e) => setDocForm({ ...docForm, version: e.target.value })} />
          </label>
          <label>
            Locale
            <select value={docForm.locale} onChange={(e) => setDocForm({ ...docForm, locale: e.target.value })}>
              <option value="es">es</option>
              <option value="en">en</option>
            </select>
          </label>
        </div>
        <label>
          Title
          <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} />
        </label>
        <label>
          Effective At (optional ISO)
          <input value={docForm.effectiveAt} onChange={(e) => setDocForm({ ...docForm, effectiveAt: e.target.value })} placeholder="2026-03-01T00:00:00Z" />
        </label>
        <label>
          Content
          <textarea rows={4} value={docForm.content} onChange={(e) => setDocForm({ ...docForm, content: e.target.value })} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={upsertDocument}>Save document</button>
          <button onClick={loadDocuments}>Reload documents</button>
        </div>
        {documents.length > 0 ? (
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: 0 }}>{JSON.stringify(documents.slice(0, 20), null, 2)}</pre>
        ) : null}
      </section>

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Enterprise DPA/SLA acceptance</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          <label>
            Instance ID
            <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </label>
          <label>
            Admin userId
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label>
            Locale
            <select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="es">es</option>
              <option value="en">en</option>
            </select>
          </label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={acceptDpa} onChange={(e) => setAcceptDpa(e.target.checked)} /> Accept DPA
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={acceptSla} onChange={(e) => setAcceptSla(e.target.checked)} /> Accept SLA
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={acceptEnterprise}>Record acceptance</button>
          <button onClick={loadAcceptances}>Load acceptances</button>
          <button onClick={downloadEvidencePack}>Download evidence pack</button>
        </div>
        {acceptances.length > 0 ? (
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: 0 }}>{JSON.stringify(acceptances, null, 2)}</pre>
        ) : null}
      </section>

      {message ? <div className="card">{message}</div> : null}
    </main>
  );
}
