"use client";

import { useState } from "react";

export default function AuditPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [query, setQuery] = useState({ category: "", action: "", from: "", to: "", limit: 100 });
  const [items, setItems] = useState<any[]>([]);
  const [verify, setVerify] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function search() {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== "" && v != null) params.set(k, String(v));
    });
    const res = await fetch(`${apiUrl}/admin/audit?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setMsg("Error cargando auditoría");
    setItems(await res.json());
    setMsg(null);
  }

  async function checkChain() {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== "" && v != null) params.set(k, String(v));
    });
    const res = await fetch(`${apiUrl}/admin/audit/verify?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setMsg("Error verificando cadena");
    setVerify(await res.json());
    setMsg(null);
  }

  async function exportPack() {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== "" && v != null) params.set(k, String(v));
    });
    const res = await fetch(`${apiUrl}/admin/audit/evidence-pack?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setMsg("Error exportando evidence pack");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidence-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Evidence pack exportado");
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1>Auditoría Inmutable</h1>
      <label>
        JWT admin/soporte
        <input value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8 }}>
        <input placeholder="category" value={query.category} onChange={(e) => setQuery({ ...query, category: e.target.value })} />
        <input placeholder="action contains" value={query.action} onChange={(e) => setQuery({ ...query, action: e.target.value })} />
        <input type="datetime-local" value={query.from} onChange={(e) => setQuery({ ...query, from: e.target.value })} />
        <input type="datetime-local" value={query.to} onChange={(e) => setQuery({ ...query, to: e.target.value })} />
        <input type="number" value={query.limit} onChange={(e) => setQuery({ ...query, limit: Number(e.target.value) })} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={search}>Buscar</button>
        <button onClick={checkChain}>Verificar Hash Chain</button>
        <button onClick={exportPack}>Export Evidence Pack</button>
      </div>
      {msg && <p>{msg}</p>}
      {verify && <pre>{JSON.stringify(verify, null, 2)}</pre>}
      <table style={{ width: "100%", fontSize: 12 }}>
        <thead>
          <tr>
            <th align="left">Fecha</th>
            <th align="left">Categoría</th>
            <th align="left">Acción</th>
            <th align="left">Actor</th>
            <th align="left">Aggregate</th>
            <th align="left">Hash</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>{item.category}</td>
              <td>{item.action}</td>
              <td>{item.actorUserId ?? "-"}</td>
              <td>{item.aggregateType ?? "-"}/{item.aggregateId ?? "-"} v{item.aggregateVersion ?? "-"}</td>
              <td><code>{String(item.chainHash).slice(0, 16)}...</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
