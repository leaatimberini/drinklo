"use client";

import { useMemo, useState } from "react";

type LotAlert = {
  lotId: string;
  productId: string;
  lotCode: string;
  product: string;
  variant: string;
  sku: string;
  quantity: number;
  expiryDate: string | null;
  daysToExpiry: number | null;
  status: "EXPIRED" | "NEAR_EXPIRY";
};

type RotationItem = {
  lotId: string;
  productId: string;
  lotCode: string;
  product: string;
  sku: string;
  quantity: number;
  expiryDate: string | null;
  suggestion: string;
};

export default function LotsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [days, setDays] = useState(30);
  const [alerts, setAlerts] = useState<LotAlert[]>([]);
  const [windows, setWindows] = useState<{ d30: LotAlert[]; d60: LotAlert[]; d90: LotAlert[] } | null>(null);
  const [rotation, setRotation] = useState<RotationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!windows) return null;
    return {
      d30: windows.d30.reduce((acc, item) => acc + item.quantity, 0),
      d60: windows.d60.reduce((acc, item) => acc + item.quantity, 0),
      d90: windows.d90.reduce((acc, item) => acc + item.quantity, 0),
    };
  }, [windows]);

  async function run() {
    setError(null);
    try {
      const [alertsRes, windowsRes, rotationRes] = await Promise.all([
        fetch(`${apiUrl}/stock/lots/alerts?days=${days}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/stock/lots/alerts/windows`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/stock/lots/rotation?limit=30`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!alertsRes.ok || !windowsRes.ok || !rotationRes.ok) {
        throw new Error("No autorizado o error al consultar lotes.");
      }

      setAlerts(await alertsRes.json());
      setWindows(await windowsRes.json());
      setRotation(await rotationRes.json());
    } catch (e: unknown) {
      setError(e.message ?? "Error inesperado");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 30 }}>Lotes y vencimientos</h1>
      <p style={{ color: "#555" }}>Vista solo admin para FEFO, productos proximos a vencer y sugerencias de rotacion.</p>

      <section style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <label>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <label>
          Ventana alertas (dias)
          <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value || 30))} />
        </label>
        <button onClick={run}>Actualizar</button>
      </section>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}

      {summary && (
        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <div style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <strong>30 dias</strong>
            <div>{summary.d30} u.</div>
          </div>
          <div style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <strong>60 dias</strong>
            <div>{summary.d60} u.</div>
          </div>
          <div style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <strong>90 dias</strong>
            <div>{summary.d90} u.</div>
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Proximos a vencer</h2>
        {alerts.length === 0 ? (
          <p>Sin datos.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {alerts.map((item) => (
              <div key={item.lotId} style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 10 }}>
                <strong>{item.product}</strong> ({item.sku}) - Lote {item.lotCode}
                <div>
                  {item.quantity} u. - {item.daysToExpiry ?? "N/A"} dias - {item.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Sugerencias de rotacion</h2>
        {rotation.length === 0 ? (
          <p>Sin sugerencias.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rotation.map((item) => (
              <div key={item.lotId} style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 10 }}>
                <strong>{item.product}</strong> ({item.sku}) - Lote {item.lotCode}
                <div>{item.quantity} u. - {item.suggestion}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
