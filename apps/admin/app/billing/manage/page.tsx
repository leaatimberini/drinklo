"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { adminSelfServeNav, pricingLegalCopy } from "../../self-serve-ui-content";

type EntitlementsResponse = {
  subscription: {
    status: string;
    currentTier: string;
    nextTier?: string | null;
    currentPeriodEnd: string;
    trialEndAt?: string | null;
    graceEndAt?: string | null;
  };
  entitlements: {
    tier: string;
    monthlyPriceArs?: number;
    ordersMonth: number;
    apiCallsMonth: number;
    storageGb: number;
    pluginsMax: number;
    branchesMax: number;
    adminUsersMax: number;
  };
  usage: {
    ordersCount: number;
    apiCallsCount: number;
    storageGbUsed: string | number;
    pluginsCount: number;
    branchesCount: number;
    adminUsersCount: number;
  };
  usagePercentages?: Record<string, number>;
  lifecycleBanners?: Array<{ kind: string; severity: string; title: string; message: string }>;
};

export default function BillingManagePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const cpDefault = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010";
  const [token, setToken] = useState("");
  const [data, setData] = useState<EntitlementsResponse | null>(null);
  const [catalog, setCatalog] = useState<unknown[]>([]);
  const [targetTier, setTargetTier] = useState("C2");
  const [preview, setPreview] = useState<unknown | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [cpUrl, setCpUrl] = useState(cpDefault);
  const [cpPortalToken, setCpPortalToken] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [portalData, setPortalData] = useState<unknown | null>(null);

  async function loadInstanceBilling() {
    setMessage(null);
    const headers = { Authorization: `Bearer ${token}` };
    const [catalogRes, entRes] = await Promise.all([
      fetch(`${apiUrl}/admin/plans/catalog`, { headers }),
      fetch(`${apiUrl}/admin/plans/entitlements`, { headers }),
    ]);
    if (!catalogRes.ok || !entRes.ok) {
      setMessage("No se pudo cargar estado de facturación (JWT requerido).");
      return;
    }
    setCatalog(await catalogRes.json());
    setData(await entRes.json());
  }

  async function previewChange(kind: "upgrade" | "downgrade") {
    setMessage(null);
    const res = await fetch(`${apiUrl}/billing/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetTier, dryRun: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(payload.error ?? `No se pudo previsualizar ${kind}`);
    setPreview({ kind, ...payload });
  }

  async function applyChange(kind: "upgrade" | "downgrade") {
    if (!window.confirm(kind === "upgrade" ? "Confirmar upgrade inmediato?" : "Confirmar downgrade al próximo ciclo?")) return;
    const res = await fetch(`${apiUrl}/billing/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetTier, dryRun: false }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(payload.error ?? `No se pudo aplicar ${kind}`);
    setMessage(kind === "upgrade" ? "Upgrade aplicado" : "Downgrade programado para próximo ciclo");
    await loadInstanceBilling();
  }

  async function loadProviderBilling() {
    if (!cpPortalToken.trim() || !instanceId.trim()) {
      setMessage("Completa instanceId y x-portal-token para ver método de pago.");
      return;
    }
    const res = await fetch(`${cpUrl}/api/billing/portal?instanceId=${encodeURIComponent(instanceId)}`, {
      headers: { "x-portal-token": cpPortalToken },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(payload.error ?? "No se pudo cargar portal de billing");
    setPortalData(payload);
  }

  async function payOpenInvoice(invoiceId: string) {
    const res = await fetch(`${cpUrl}/api/billing/invoices/${encodeURIComponent(invoiceId)}/pay`, {
      method: "POST",
      headers: { "x-portal-token": cpPortalToken },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.initPoint) return setMessage(payload.error ?? "No se pudo iniciar pago");
    window.open(payload.initPoint, "_blank", "noopener,noreferrer");
  }

  const usageRows = useMemo(
    () =>
      data
        ? [
            ["Pedidos/mes", data.usage.ordersCount, data.entitlements.ordersMonth, data.usagePercentages?.ordersMonth],
            ["API calls/mes", data.usage.apiCallsCount, data.entitlements.apiCallsMonth, data.usagePercentages?.apiCallsMonth],
            ["Storage (GB)", Number(data.usage.storageGbUsed), data.entitlements.storageGb, data.usagePercentages?.storageGb],
            ["Plugins", data.usage.pluginsCount, data.entitlements.pluginsMax, data.usagePercentages?.pluginsMax],
            ["Sucursales", data.usage.branchesCount, data.entitlements.branchesMax, data.usagePercentages?.branchesMax],
            ["Admins", data.usage.adminUsersCount, data.entitlements.adminUsersMax, data.usagePercentages?.adminUsersMax],
          ]
        : [],
    [data],
  );

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: 8 }}>Billing Manage</h1>
      <p>Autogestión: estado actual, uso/límites, upgrades, downgrades y pagos (si aplica).</p>

      <nav style={{ display: "flex", gap: 12, margin: "12px 0 20px" }}>
        {adminSelfServeNav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>

      <section className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Cuenta (instance API)</h2>
        <label>
          JWT Admin
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={loadInstanceBilling}>Cargar estado actual</button>
          <Link href="/plan-billing">Vista avanzada</Link>
        </div>
        {data ? (
          <>
            {(data.lifecycleBanners ?? []).map((b) => (
              <div key={b.kind} style={{ marginTop: 8, border: "1px solid #ddd", padding: 8, borderRadius: 8 }}>
                <strong>{b.title}</strong> <div>{b.message}</div>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <div><strong>Estado:</strong> {data.subscription.status}</div>
              <div><strong>Tier actual:</strong> {data.subscription.currentTier}</div>
              <div><strong>Próximo tier:</strong> {data.subscription.nextTier ?? "-"}</div>
              <div><strong>Renovación / fin ciclo:</strong> {new Date(data.subscription.currentPeriodEnd).toLocaleString()}</div>
              <div><strong>Trial hasta:</strong> {data.subscription.trialEndAt ? new Date(data.subscription.trialEndAt).toLocaleString() : "-"}</div>
            </div>
            <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr><th align="left">Límite</th><th align="right">Uso</th><th align="right">Plan</th><th align="right">% uso</th></tr>
              </thead>
              <tbody>
                {usageRows.map(([label, used, limit, pct]) => (
                  <tr key={String(label)}>
                    <td>{String(label)}</td>
                    <td align="right">{String(used)}</td>
                    <td align="right">{String(limit)}</td>
                    <td align="right">{pct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <label>
                Tier destino
                <select value={targetTier} onChange={(e) => setTargetTier(e.target.value)}>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                  <option value="C3">C3</option>
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button onClick={() => previewChange("upgrade")}>Preview upgrade inmediato</button>
                <button onClick={() => applyChange("upgrade")}>Aplicar upgrade</button>
                <button onClick={() => previewChange("downgrade")}>Preview downgrade próximo ciclo</button>
                <button onClick={() => applyChange("downgrade")}>Programar downgrade</button>
              </div>
              {preview ? (
                <pre style={{ background: "#f6f6f6", padding: 8, marginTop: 8, overflowX: "auto" }}>
                  {JSON.stringify(preview, null, 2)}
                </pre>
              ) : null}
            </div>
            <div style={{ marginTop: 12 }}>
              <h3>Comparación rápida de tiers</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr><th align="left">Tier</th><th align="right">Precio</th><th align="right">Orders</th><th align="right">API</th><th align="right">Storage</th></tr>
                </thead>
                <tbody>
                  {catalog.map((item) => (
                    <tr key={item.tier}>
                      <td>{item.tier}</td>
                      <td align="right">ARS {item.monthlyPriceArs ?? 0}</td>
                      <td align="right">{item.ordersMonth}</td>
                      <td align="right">{item.apiCallsMonth}</td>
                      <td align="right">{item.storageGb} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Método de pago (si aplica)</h2>
        <p>Usa el portal del billing provider para facturas y pagos (ej. Mercado Pago).</p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <label>
            Control-plane URL
            <input value={cpUrl} onChange={(e) => setCpUrl(e.target.value)} />
          </label>
          <label>
            x-portal-token
            <input value={cpPortalToken} onChange={(e) => setCpPortalToken(e.target.value)} />
          </label>
          <label>
            Instance ID
            <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </label>
        </div>
        <button style={{ marginTop: 8 }} onClick={loadProviderBilling}>Cargar portal billing</button>
        {portalData?.account ? (
          <div style={{ marginTop: 12 }}>
            <div><strong>Cuenta provider:</strong> {portalData.account.instanceId} · {portalData.account.status}</div>
            <div><strong>Plan:</strong> {portalData.account.plan?.name ?? "-"}</div>
            <div><strong>Próximo cobro:</strong> {portalData.account.nextBillingAt ? new Date(portalData.account.nextBillingAt).toLocaleString() : "-"}</div>
            <h3>Facturas</h3>
            <ul>
              {(portalData.invoices ?? []).slice(0, 8).map((inv: unknown) => (
                <li key={inv.id}>
                  {inv.status} · {inv.currency} {inv.amount}
                  {inv.status === "OPEN" ? <> <button onClick={() => payOpenInvoice(inv.id)}>Pagar</button></> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Términos y consentimiento</h2>
        <h3>Trial 30 días</h3>
        <ul>{pricingLegalCopy.trialTerms.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Grace / Restricted</h3>
        <ul>{pricingLegalCopy.graceRestricted.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Consentimiento marketing (separado)</h3>
        <ul>{pricingLegalCopy.marketingConsent.map((line) => <li key={line}>{line}</li>)}</ul>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
          Confirmación visual de consentimiento marketing separado (no implícito)
        </label>
      </section>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </main>
  );
}

