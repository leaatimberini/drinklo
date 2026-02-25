"use client";

import { useState } from "react";

type EntitlementsResponse = {
  subscription: {
    status: string;
    currentTier: string;
    nextTier?: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndAt?: string | null;
    graceEndAt?: string | null;
  };
  entitlements: {
    tier: string;
    ordersMonth: number;
    apiCallsMonth: number;
    storageGb: number;
    pluginsMax: number;
    branchesMax: number;
    adminUsersMax: number;
    sloTarget: string;
    drFrequency: string;
    supportLevel: string;
  };
  usage: {
    periodKey: string;
    ordersCount: number;
    apiCallsCount: number;
    storageGbUsed: string | number;
    pluginsCount: number;
    branchesCount: number;
    adminUsersCount: number;
  };
  usagePercentages?: Record<string, number>;
  timezone?: string;
};

export default function PlanBillingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<any[]>([]);
  const [data, setData] = useState<EntitlementsResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setMessage(null);
    const headers = { Authorization: `Bearer ${token}` };
    const [catalogRes, entitlementsRes] = await Promise.all([
      fetch(`${apiUrl}/admin/plans/catalog`, { headers }),
      fetch(`${apiUrl}/admin/plans/entitlements`, { headers }),
    ]);
    if (!catalogRes.ok || !entitlementsRes.ok) {
      setMessage("No se pudo cargar informacion del plan");
      return;
    }
    setCatalog(await catalogRes.json());
    setData(await entitlementsRes.json());
  }

  const rows = data
    ? [
        ["Pedidos/mes", data.usage.ordersCount, data.entitlements.ordersMonth, data.usagePercentages?.ordersMonth],
        ["API calls/mes", data.usage.apiCallsCount, data.entitlements.apiCallsMonth, data.usagePercentages?.apiCallsMonth],
        ["Storage (GB)", Number(data.usage.storageGbUsed), data.entitlements.storageGb, data.usagePercentages?.storageGb],
        ["Plugins", data.usage.pluginsCount, data.entitlements.pluginsMax, data.usagePercentages?.pluginsMax],
        ["Sucursales", data.usage.branchesCount, data.entitlements.branchesMax, data.usagePercentages?.branchesMax],
        ["Admins", data.usage.adminUsersCount, data.entitlements.adminUsersMax, data.usagePercentages?.adminUsersMax],
      ]
    : [];

  return (
    <main style={{ padding: 32, maxWidth: 980 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Plan y Facturacion</h1>
      <p>Tier actual, estado de suscripcion, limites y consumo mensual.</p>

      <label style={{ display: "block", marginTop: 12 }}>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>
      <button style={{ marginTop: 12 }} onClick={load}>Cargar</button>

      {data && (
        <>
          <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}>
            <h2 style={{ marginTop: 0 }}>Resumen</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>
              <div><strong>Estado:</strong> {data.subscription.status}</div>
              <div><strong>Tier actual:</strong> {data.subscription.currentTier}</div>
              <div><strong>Proximo tier:</strong> {data.subscription.nextTier ?? "-"}</div>
              <div><strong>Periodo actual:</strong> {new Date(data.subscription.currentPeriodStart).toLocaleString()} - {new Date(data.subscription.currentPeriodEnd).toLocaleString()}</div>
              <div><strong>Trial hasta:</strong> {data.subscription.trialEndAt ? new Date(data.subscription.trialEndAt).toLocaleString() : "-"}</div>
              <div><strong>Timezone:</strong> {data.timezone ?? "America/Argentina/Buenos_Aires"}</div>
            </div>
          </section>

          <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}>
            <h2 style={{ marginTop: 0 }}>Entitlements del tier {data.entitlements.tier}</h2>
            <p style={{ marginTop: 0 }}>SLO: {data.entitlements.sloTarget} - DR: {data.entitlements.drFrequency} - Soporte: {data.entitlements.supportLevel}</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Quota</th>
                  <th align="right">Uso</th>
                  <th align="right">Limite</th>
                  <th align="right">% uso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, used, limit, pct]) => (
                  <tr key={String(name)}>
                    <td style={{ padding: "6px 0" }}>{name}</td>
                    <td align="right">{String(used)}</td>
                    <td align="right">{String(limit)}</td>
                    <td align="right">{pct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>Catalogo de tiers</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Tier</th>
              <th align="right">Orders</th>
              <th align="right">API calls</th>
              <th align="right">Storage GB</th>
              <th align="right">Plugins</th>
              <th align="right">Branches</th>
              <th align="right">Admins</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((item) => (
              <tr key={item.tier}>
                <td>{item.tier}</td>
                <td align="right">{item.ordersMonth}</td>
                <td align="right">{item.apiCallsMonth}</td>
                <td align="right">{item.storageGb}</td>
                <td align="right">{item.pluginsMax}</td>
                <td align="right">{item.branchesMax}</td>
                <td align="right">{item.adminUsersMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </main>
  );
}
