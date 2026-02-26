"use client";

import { useMemo, useState } from "react";

export default function BiPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cohorts, setCohorts] = useState<unknown[]>([]);
  const [retention, setRetention] = useState<unknown[]>([]);
  const [ltv, setLtv] = useState<unknown | null>(null);
  const [rfm, setRfm] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rangeLabel = useMemo(() => {
    if (!from || !to) return "�ltimos 12 meses";
    return `${from} ? ${to}`;
  }, [from, to]);

  function buildParams() {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(`${from}T00:00:00-03:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59-03:00`).toISOString());
    return params.toString();
  }

  async function fetchData() {
    setLoading(true);
    setMessage(null);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const qs = buildParams();
      const [cohortRes, retentionRes, ltvRes, rfmRes] = await Promise.all([
        fetch(`${apiUrl}/admin/bi/cohorts?${qs}`, { headers }),
        fetch(`${apiUrl}/admin/bi/retention?${qs}`, { headers }),
        fetch(`${apiUrl}/admin/bi/ltv?${qs}`, { headers }),
        fetch(`${apiUrl}/admin/bi/rfm?${qs}`, { headers }),
      ]);
      if (!cohortRes.ok || !retentionRes.ok || !ltvRes.ok || !rfmRes.ok) {
        throw new Error("No se pudo cargar BI");
      }
      setCohorts(await cohortRes.json());
      setRetention(await retentionRes.json());
      setLtv(await ltvRes.json());
      setRfm(await rfmRes.json());
    } catch (err: unknown) {
      setMessage(err.message ?? "Error cargando BI");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontFamily: "var(--font-heading)" }}>BI Avanzado</h1>
      <p style={{ color: "#555" }}>Zona horaria: America/Argentina/Buenos_Aires � Moneda: ARS</p>

      <section style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 520 }}>
        <label>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" style={{ marginTop: 6 }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <label>
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <button onClick={fetchData} disabled={loading || !token}>
          {loading ? "Cargando" : "Actualizar"}
        </button>
        {message && <p style={{ color: "crimson" }}>{message}</p>}
      </section>

      {ltv && (
        <section style={{ marginTop: 24 }}>
          <h2>LTV ({rangeLabel})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Avg LTV</strong>
              <div>${Number(ltv.avg_ltv ?? 0).toFixed(2)}</div>
            </div>
            <div style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Median LTV</strong>
              <div>${Number(ltv.median_ltv ?? 0).toFixed(2)}</div>
            </div>
            <div style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Total revenue</strong>
              <div>${Number(ltv.total_revenue ?? 0).toFixed(2)}</div>
            </div>
            <div style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
              <strong>Clientes</strong>
              <div>{Number(ltv.customers ?? 0)}</div>
            </div>
          </div>
        </section>
      )}

      {cohorts.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Cohortes</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Mes</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Clientes</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Repetidores</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>�rdenes promedio</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((row) => (
                <tr key={row.cohort_month}>
                  <td>{String(row.cohort_month).slice(0, 10)}</td>
                  <td>{row.customers}</td>
                  <td>{row.repeat_customers}</td>
                  <td>{row.avg_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {retention.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Retenci�n 30 d�as</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Mes</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Clientes</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Activos 30d</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {retention.map((row) => (
                <tr key={row.cohort_month}>
                  <td>{String(row.cohort_month).slice(0, 10)}</td>
                  <td>{row.customers}</td>
                  <td>{row.active_30d}</td>
                  <td>{row.retention_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rfm.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>RFM (Top clientes)</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Cliente</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Recency (d)</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Frequency</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Monetary (ARS)</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Segmento</th>
              </tr>
            </thead>
            <tbody>
              {rfm.map((row) => (
                <tr key={row.customer_email}>
                  <td>{row.customer_email}</td>
                  <td>{row.recency_days}</td>
                  <td>{row.frequency}</td>
                  <td>{Number(row.monetary).toFixed(2)}</td>
                  <td>{row.segment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
