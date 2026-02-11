"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SearchAdminPage() {
  const [token, setToken] = useState("");
  const [synonyms, setSynonyms] = useState("{}");
  const [stockWeight, setStockWeight] = useState(1);
  const [marginWeight, setMarginWeight] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("admin_token", token);
      loadConfig();
    }
  }, [token]);

  async function loadConfig() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/search/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("No se pudo cargar config");
      return;
    }
    const data = await res.json();
    setSynonyms(JSON.stringify(data.synonyms ?? {}, null, 2));
    setStockWeight(Number(data.boosters?.stockWeight ?? 1));
    setMarginWeight(Number(data.boosters?.marginWeight ?? 1));
  }

  async function saveConfig() {
    setMessage(null);
    let parsed: any = {};
    try {
      parsed = JSON.parse(synonyms || "{}");
    } catch {
      setMessage("Sinónimos inválidos (JSON)");
      return;
    }

    const res = await fetch(`${apiUrl}/admin/search/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        synonyms: parsed,
        boosters: { stockWeight, marginWeight },
      }),
    });

    if (!res.ok) {
      setMessage("No se pudo guardar config");
      return;
    }
    setMessage("Configuración guardada");
  }

  async function reindex(mode: "full" | "incremental") {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/search/reindex`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      setMessage("No se pudo encolar reindex");
      return;
    }
    setMessage(`Reindex ${mode} encolado`);
  }

  return (
    <main style={{ padding: 32, display: "grid", gap: 16, maxWidth: 820 }}>
      <h1 style={{ fontSize: 28 }}>Search Config</h1>

      <label>
        Token
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <label>
        Sinónimos (JSON)
        <textarea
          value={synonyms}
          onChange={(e) => setSynonyms(e.target.value)}
          rows={10}
          style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular" }}
        />
      </label>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          Boost stock
          <input type="number" value={stockWeight} onChange={(e) => setStockWeight(Number(e.target.value))} />
        </label>
        <label>
          Boost margen
          <input type="number" value={marginWeight} onChange={(e) => setMarginWeight(Number(e.target.value))} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={saveConfig}>Guardar</button>
        <button onClick={() => reindex("incremental")}>Reindex incremental</button>
        <button onClick={() => reindex("full")}>Reindex full</button>
      </div>

      {message && <p>{message}</p>}
    </main>
  );
}
