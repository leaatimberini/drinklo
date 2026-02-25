"use client";

import { useEffect, useMemo, useState } from "react";

function todayBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function daysAgoBa(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default function TrialAnalyticsPage() {
  const [from, setFrom] = useState(daysAgoBa(30));
  const [to, setTo] = useState(todayBa());
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(sync = true) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/trial-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&sync=${sync ? "1" : "0"}`);
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? "failed to load trial analytics");
      return;
    }
    setData(payload);
  }

  useEffect(() => {
    load(false).catch((e) => setError(e.message));
  }, []);

  const total = data?.totals;
  const conversionSummary = useMemo(() => {
    if (!total) return null;
    return `Signups ${total.signups} · Trials ${total.trialStarted} · Add payment ${total.paymentMethodAdded} · Converted ${total.convertedToPaid} (${total.conversionRate}%)`;
  }, [total]);

  return (
    <main>
      <h1>Trial Funnel Analytics</h1>
      <p>Funnel por campaña, cohortes 7/14/30 e ICP conversion para trials del proveedor.</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <label>
            Desde (BA)
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Hasta (BA)
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button onClick={() => load(true)} disabled={loading}>{loading ? "Cargando..." : "Refresh + Sync"}</button>
          <a href={`/api/trial-analytics/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>Export CSV</a>
          <a href={`/api/trial-analytics/bi?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>API BI (JSON)</a>
        </div>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {data?.range?.invalid ? <p style={{ color: "#b45309" }}>Rango inválido, se aplicó fallback.</p> : null}
      </section>

      {data ? (
        <>
          <section className="card" style={{ marginBottom: 16 }}>
            <h2>Resumen</h2>
            <p>{conversionSummary}</p>
            <p>
              Campañas: {data.summary?.campaignsTotal ?? 0} · Trials activos: {data.summary?.activeTrials ?? 0} · Eventos en rango:{" "}
              {data.summary?.eventsInRange ?? 0}
            </p>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <h2>Funnel por campaña</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Campaña</th>
                  <th align="right">Signups</th>
                  <th align="right">Trial</th>
                  <th align="right">Add payment</th>
                  <th align="right">Converted</th>
                  <th align="right">Conv %</th>
                  <th align="right">Past due</th>
                  <th align="right">Restricted</th>
                </tr>
              </thead>
              <tbody>
                {(data.funnel ?? []).map((row: any) => (
                  <tr key={`${row.campaignId ?? row.campaignCode}`}>
                    <td>{row.campaignCode} {row.campaignTier ? `(${row.campaignTier})` : ""}</td>
                    <td align="right">{row.signups}</td>
                    <td align="right">{row.trialStarted}</td>
                    <td align="right">{row.paymentMethodAdded}</td>
                    <td align="right">{row.convertedToPaid}</td>
                    <td align="right">{row.conversionRate}%</td>
                    <td align="right">{row.becamePastDue}</td>
                    <td align="right">{row.becameRestricted}</td>
                  </tr>
                ))}
                {(data.funnel ?? []).length === 0 ? (
                  <tr><td colSpan={8}>Sin datos en rango.</td></tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <h2>Cohortes 7/14/30 días</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Cohorte (BA)</th>
                  <th align="right">Starts</th>
                  <th align="right">7d</th>
                  <th align="right">14d</th>
                  <th align="right">30d</th>
                  <th align="right">Rate 7d</th>
                  <th align="right">Rate 14d</th>
                  <th align="right">Rate 30d</th>
                </tr>
              </thead>
              <tbody>
                {(data.cohorts ?? []).map((row: any) => (
                  <tr key={row.cohortDate}>
                    <td>{row.cohortDate}</td>
                    <td align="right">{row.starts}</td>
                    <td align="right">{row.converted7d}</td>
                    <td align="right">{row.converted14d}</td>
                    <td align="right">{row.converted30d}</td>
                    <td align="right">{row.rate7d}%</td>
                    <td align="right">{row.rate14d}%</td>
                    <td align="right">{row.rate30d}%</td>
                  </tr>
                ))}
                {(data.cohorts ?? []).length === 0 ? <tr><td colSpan={8}>Sin cohortes.</td></tr> : null}
              </tbody>
            </table>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <h2>Conversión por ICP</h2>
            <p>Usa `LeadAttribution.businessType` cuando está disponible (ej. kiosco/distribuidora).</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Business Type</th>
                  <th align="right">Signups</th>
                  <th align="right">Trial</th>
                  <th align="right">Converted</th>
                  <th align="right">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {(data.icp ?? []).map((row: any) => (
                  <tr key={row.businessType}>
                    <td>{row.businessType}</td>
                    <td align="right">{row.signups}</td>
                    <td align="right">{row.trialStarted}</td>
                    <td align="right">{row.convertedToPaid}</td>
                    <td align="right">{row.conversionRate}%</td>
                  </tr>
                ))}
                {(data.icp ?? []).length === 0 ? <tr><td colSpan={5}>Sin datos ICP.</td></tr> : null}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Eventos recientes</h2>
            <ul>
              {(data.recentEvents ?? []).slice(0, 50).map((evt: any) => (
                <li key={evt.id}>
                  {new Date(evt.eventAt).toISOString()} · {evt.eventType}
                  {evt.instanceId ? ` · ${evt.instanceId}` : ""}
                  {evt.businessType ? ` · ${evt.businessType}` : ""}
                </li>
              ))}
              {(data.recentEvents ?? []).length === 0 ? <li>Sin eventos.</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
