"use client";

import { useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ForecastPoint = { date: string; quantity: number };

type ForecastRow = {
  productId: string;
  productName: string;
  forecast: ForecastPoint[];
  reorderPoint: number;
  reorderQuantity: number;
  currentStock: number;
  avgDaily: number;
};

export default function ForecastingPage() {
  const [token, setToken] = useState("");
  const [horizon, setHorizon] = useState("14");
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  async function load() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/forecasting?horizonDays=${horizon}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("No se pudo cargar forecast");
      return;
    }
    const data = await res.json();
    setRows(data);
  }

  useEffect(() => {
    if (token) {
      localStorage.setItem("admin_token", token);
      load();
    }
  }, [token]);

  const csv = useMemo(() => {
    const lines = ["productId,productName,reorderPoint,reorderQuantity,currentStock,avgDaily"];
    for (const row of rows) {
      lines.push(
        `${row.productId},"${row.productName}",${row.reorderPoint},${row.reorderQuantity},${row.currentStock},${row.avgDaily}`,
      );
    }
    return lines.join("\n");
  }, [rows]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `forecast_${horizon}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: 32, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28 }}>Compras sugeridas</h1>

      <label>
        Token
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          Horizonte
          <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
            <option value="7">7 días</option>
            <option value="14">14 días</option>
            <option value="30">30 días</option>
          </select>
        </label>
        <button onClick={load}>Actualizar</button>
        <button onClick={downloadCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>

      {message && <p>{message}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <div key={row.productId} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: 10 }}>
            <strong>{row.productName}</strong>
            <p>Stock: {row.currentStock} · Avg diario: {row.avgDaily}</p>
            <p>Reorder point: {row.reorderPoint} · Reorder qty: {row.reorderQuantity}</p>
            <p>Forecast ({horizon}d): {row.forecast.map((f) => f.quantity).join(", ")}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
