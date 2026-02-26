"use client";

import { useEffect, useMemo, useState } from "react";
import { emitEvent } from "../lib/events";

export default function DashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const eventToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const [fx, setFx] = useState<unknown[]>([]);
  const [slots, setSlots] = useState<unknown[]>([]);

  const rangeLabel = useMemo(() => {
    if (!from || !to) return "Ultimos 7 dias";
    return `${from} - ${to}`;
  }, [from, to]);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(`${from}T00:00:00-03:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59-03:00`).toISOString());
    const res = await fetch(`${apiUrl}/dashboard/summary?${params.toString()}`);
    const payload = await res.json();
    setData(payload);
    setLoading(false);
  }

  async function fetchFx() {
    const res = await fetch(`${apiUrl}/fx/latest?codes=USD,BRL,EUR`);
    const payload = await res.json();
    setFx(payload ?? []);
  }

  async function fetchSlots() {
    const res = await fetch(`${apiUrl}/plugins/ui?slot=admin.dashboard`);
    if (res.ok) {
      setSlots(await res.json());
    }
  }

  function exportFile(ext: "csv" | "xlsx") {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(`${from}T00:00:00-03:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59-03:00`).toISOString());
    window.location.href = `${apiUrl}/dashboard/export.${ext}?${params.toString()}`;
  }

  useEffect(() => {
    fetchFx();
    fetchData();
    fetchSlots();
    emitEvent(apiUrl, "DashboardViewed", { view: "dashboard" }, { token: eventToken });
  }, [apiUrl, eventToken]);

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 32, fontFamily: "var(--font-heading)" }}>Dashboard</h1>
      <p style={{ color: "var(--color-text-subtle)" }}>Zona horaria: America/Argentina/Buenos_Aires</p>

      <section style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "end" }}>
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={fetchData} disabled={loading}>
          {loading ? "Cargando" : "Aplicar"}
        </button>
        <button onClick={() => exportFile("csv")}>CSV</button>
        <button onClick={() => exportFile("xlsx")}>XLSX</button>
        <button onClick={fetchFx}>Actualizar FX</button>
      </section>

      {fx.length > 0 && (
        <section style={{ marginTop: 16, display: "flex", gap: 12 }}>
          {fx.map((row) => (
            <div key={row.currencyCode} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>{row.currencyCode}</strong>
              <div>{Number(row.rate).toFixed(2)}</div>
              <small>{row.source}</small>
            </div>
          ))}
        </section>
      )}

      {data && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 8 }}>KPIs ({rangeLabel})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Ventas</strong>
              <p>{data.kpis.sales}</p>
            </div>
            <div style={{ padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Margen</strong>
              <p>{data.kpis.margin}</p>
            </div>
            <div style={{ padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Ticket Promedio</strong>
              <p>{data.kpis.avgTicket}</p>
            </div>
            <div style={{ padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Tickets</strong>
              <p>{data.kpis.tickets}</p>
            </div>
            <div style={{ padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Gastos</strong>
              <p>{data.kpis.expenses}</p>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Top productos</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {data.topProducts.map((item: unknown) => (
                <div key={item.productId} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
                  {item.name} - ${item.revenue} ({item.qty})
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Stock critico</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {data.lowStock.map((item: unknown) => (
                <div key={item.variantId} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
                  {item.sku} - {item.quantity}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {slots.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Plugins</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {slots.map((slot: unknown, index: number) => (
              <div key={`${slot.plugin}-${index}`} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
                <strong>{slot.title}</strong>
                <p style={{ marginTop: 8 }}>{slot.body}</p>
                <small style={{ color: "var(--color-text-subtle)" }}>{slot.plugin}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
