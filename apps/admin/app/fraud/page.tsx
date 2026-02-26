"use client";

import { useState } from "react";

type FraudItem = {
  id: string;
  score: number;
  riskLevel: string;
  action: string;
  reasonSummary: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  order?: {
    id: string;
    customerName: string;
    customerEmail: string;
    status: string;
  } | null;
  reasons: Array<{ code: string; label: string; points: number; details: Record<string, unknown> }>;
};

export default function FraudPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "DISMISSED">("OPEN");
  const [items, setItems] = useState<FraudItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadQueue() {
    setError(null);
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/fraud/queue?status=${status}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? "No autorizado");
      return;
    }
    const data = await res.json();
    setItems(data);
  }

  async function review(id: string, nextStatus: "RESOLVED" | "DISMISSED") {
    setError(null);
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/fraud/review/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? "Error al actualizar");
      return;
    }
    setMessage(`Caso ${id} actualizado a ${nextStatus}`);
    await loadQueue();
  }

  return (
    <main style={{ padding: 32, maxWidth: 1080 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 30 }}>Fraude y anomalias</h1>
      <p style={{ color: "#555" }}>Cola de revision con explicabilidad de scoring.</p>

      <section style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <label>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value as unknown)}>
            <option value="OPEN">OPEN</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
        </label>
        <button onClick={loadQueue}>Cargar cola</button>
      </section>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}

      <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
        {items.map((item) => (
          <article key={item.id} style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>
                Score {item.score} - {item.riskLevel} - {item.action}
              </strong>
              <small>{new Date(item.createdAt).toLocaleString()}</small>
            </div>
            <p style={{ marginTop: 8 }}>{item.reasonSummary}</p>
            {item.order && (
              <p style={{ color: "#555" }}>
                Orden {item.order.id} - {item.order.customerName} ({item.order.customerEmail})
              </p>
            )}
            <details>
              <summary>Explicabilidad</summary>
              <pre style={{ background: "#f8f8f8", padding: 8, overflow: "auto" }}>{JSON.stringify(item.reasons, null, 2)}</pre>
            </details>
            {item.status === "OPEN" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => review(item.id, "RESOLVED")}>Marcar resuelto</button>
                <button onClick={() => review(item.id, "DISMISSED")}>Descartar</button>
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
