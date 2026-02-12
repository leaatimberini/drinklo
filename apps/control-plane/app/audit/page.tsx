"use client";

import { useState } from "react";

export default function ControlPlaneAuditPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:3001");
  const [token, setToken] = useState("");
  const [query, setQuery] = useState({ category: "", action: "", from: "", to: "", limit: 100 });
  const [items, setItems] = useState<any[]>([]);
  const [verify, setVerify] = useState<any>(null);

  const buildParams = () => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== "" && v != null) params.set(k, String(v));
    });
    return params.toString();
  };

  async function load() {
    const res = await fetch(`${apiBaseUrl}/admin/audit?${buildParams()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    setItems(await res.json());
  }

  async function check() {
    const res = await fetch(`${apiBaseUrl}/admin/audit/verify?${buildParams()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    setVerify(await res.json());
  }

  async function exportPack() {
    const res = await fetch(`${apiBaseUrl}/admin/audit/evidence-pack?${buildParams()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-plane-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1>Immutable Audit Explorer</h1>
      <p>Consulta por instancia y export evidence packs firmados.</p>
      <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="API base URL" />
      <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin JWT de la instancia" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8 }}>
        <input placeholder="category" value={query.category} onChange={(e) => setQuery({ ...query, category: e.target.value })} />
        <input placeholder="action" value={query.action} onChange={(e) => setQuery({ ...query, action: e.target.value })} />
        <input type="datetime-local" value={query.from} onChange={(e) => setQuery({ ...query, from: e.target.value })} />
        <input type="datetime-local" value={query.to} onChange={(e) => setQuery({ ...query, to: e.target.value })} />
        <input type="number" value={query.limit} onChange={(e) => setQuery({ ...query, limit: Number(e.target.value) })} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load}>Search</button>
        <button onClick={check}>Verify Chain</button>
        <button onClick={exportPack}>Export Evidence</button>
      </div>
      {verify ? <pre>{JSON.stringify(verify, null, 2)}</pre> : null}
      <table style={{ width: "100%", fontSize: 12 }}>
        <thead><tr><th align="left">Date</th><th align="left">Category</th><th align="left">Action</th><th align="left">Hash</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.category}</td><td>{item.action}</td><td><code>{String(item.chainHash).slice(0, 16)}...</code></td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
