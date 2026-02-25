"use client";

import Link from "next/link";
import { useState } from "react";
import { pricingLegalCopy, storefrontSelfServeNav } from "../../self-serve-ui-content";

export default function StorefrontBillingManagePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const cpDefault = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010";
  const [jwt, setJwt] = useState("");
  const [state, setState] = useState<any | null>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [targetTier, setTargetTier] = useState("C2");
  const [preview, setPreview] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [cpUrl, setCpUrl] = useState(cpDefault);
  const [portalToken, setPortalToken] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [portalData, setPortalData] = useState<any | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  async function loadState() {
    setMessage(null);
    const headers = { Authorization: `Bearer ${jwt}` };
    const [catalogRes, entRes] = await Promise.all([
      fetch(`${apiUrl}/admin/plans/catalog`, { headers }),
      fetch(`${apiUrl}/admin/plans/entitlements`, { headers }),
    ]);
    if (!catalogRes.ok || !entRes.ok) {
      setMessage("Ingresá JWT admin para gestionar plan desde esta pantalla.");
      return;
    }
    setCatalog(await catalogRes.json());
    setState(await entRes.json());
  }

  async function previewChange(kind: "upgrade" | "downgrade") {
    const res = await fetch(`${apiUrl}/billing/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ targetTier, dryRun: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(payload.error ?? "No se pudo previsualizar");
    setPreview({ kind, ...payload });
  }

  async function applyChange(kind: "upgrade" | "downgrade") {
    const res = await fetch(`${apiUrl}/billing/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ targetTier, dryRun: false }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(payload.error ?? "No se pudo aplicar cambio");
    setMessage(kind === "upgrade" ? "Upgrade aplicado" : "Downgrade programado al próximo ciclo");
    await loadState();
  }

  async function loadProviderBilling() {
    const res = await fetch(`${cpUrl}/api/billing/portal?instanceId=${encodeURIComponent(instanceId)}`, {
      headers: { "x-portal-token": portalToken },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(payload.error ?? "No se pudo cargar portal");
    setPortalData(payload);
  }

  async function payInvoice(invoiceId: string) {
    const res = await fetch(`${cpUrl}/api/billing/invoices/${encodeURIComponent(invoiceId)}/pay`, {
      method: "POST",
      headers: { "x-portal-token": portalToken },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.initPoint) return setMessage(payload.error ?? "No se pudo iniciar pago");
    window.open(payload.initPoint, "_blank", "noopener,noreferrer");
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: 8 }}>Billing Manage</h1>
      <p>Autogestión del plan: estado actual, uso/límites, upgrades y downgrades. Método de pago según provider.</p>

      <nav style={{ display: "flex", gap: 12, margin: "12px 0 20px" }}>
        {storefrontSelfServeNav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Estado actual + uso/límites (API instancia)</h2>
        <label>
          JWT admin (requerido para cambios)
          <input value={jwt} onChange={(e) => setJwt(e.target.value)} placeholder="Bearer token" />
        </label>
        <button style={{ marginTop: 8 }} onClick={loadState}>Cargar estado</button>
        {state ? (
          <div style={{ marginTop: 12 }}>
            <div><strong>Estado:</strong> {state.subscription?.status}</div>
            <div><strong>Tier:</strong> {state.subscription?.currentTier}</div>
            <div><strong>Próximo tier:</strong> {state.subscription?.nextTier ?? "-"}</div>
            <div><strong>Fin ciclo:</strong> {state.subscription?.currentPeriodEnd ? new Date(state.subscription.currentPeriodEnd).toLocaleString() : "-"}</div>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
              <thead><tr><th align="left">Métrica</th><th align="right">Uso</th><th align="right">Límite</th></tr></thead>
              <tbody>
                <tr><td>Pedidos/mes</td><td align="right">{state.usage?.ordersCount ?? 0}</td><td align="right">{state.entitlements?.ordersMonth ?? 0}</td></tr>
                <tr><td>API calls/mes</td><td align="right">{state.usage?.apiCallsCount ?? 0}</td><td align="right">{state.entitlements?.apiCallsMonth ?? 0}</td></tr>
                <tr><td>Storage (GB)</td><td align="right">{String(state.usage?.storageGbUsed ?? 0)}</td><td align="right">{state.entitlements?.storageGb ?? 0}</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}>
              <label>
                Tier destino
                <select value={targetTier} onChange={(e) => setTargetTier(e.target.value)}>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                  <option value="C3">C3</option>
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button onClick={() => previewChange("upgrade")}>Upgrade inmediato (preview)</button>
                <button onClick={() => applyChange("upgrade")}>Aplicar upgrade</button>
                <button onClick={() => previewChange("downgrade")}>Downgrade próximo ciclo (preview)</button>
                <button onClick={() => applyChange("downgrade")}>Programar downgrade</button>
              </div>
              {preview ? <pre style={{ background: "#f6f6f6", padding: 8, marginTop: 8 }}>{JSON.stringify(preview, null, 2)}</pre> : null}
            </div>
            {catalog.length > 0 ? (
              <details style={{ marginTop: 8 }}>
                <summary>Comparación de límites (C1/C2/C3)</summary>
                <pre style={{ background: "#f6f6f6", padding: 8 }}>{JSON.stringify(catalog, null, 2)}</pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Método de pago (provider billing, si aplica)</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <label>
            Control-plane URL
            <input value={cpUrl} onChange={(e) => setCpUrl(e.target.value)} />
          </label>
          <label>
            x-portal-token
            <input value={portalToken} onChange={(e) => setPortalToken(e.target.value)} />
          </label>
          <label>
            Instance ID
            <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </label>
        </div>
        <button style={{ marginTop: 8 }} onClick={loadProviderBilling}>Cargar portal billing</button>
        {portalData?.account ? (
          <div style={{ marginTop: 12 }}>
            <div><strong>Cuenta:</strong> {portalData.account.instanceId} · {portalData.account.status}</div>
            <div><strong>Plan:</strong> {portalData.account.plan?.name ?? "-"}</div>
            <div><strong>Facturas abiertas:</strong> {(portalData.invoices ?? []).filter((x: any) => x.status === "OPEN").length}</div>
            <ul>
              {(portalData.invoices ?? []).slice(0, 8).map((inv: any) => (
                <li key={inv.id}>
                  {inv.status} · {inv.currency} {inv.amount}
                  {inv.status === "OPEN" ? <> <button onClick={() => payInvoice(inv.id)}>Pagar</button></> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Términos legales y consentimiento</h2>
        <h3>Trial / Grace / Restricted</h3>
        <ul>{pricingLegalCopy.trialTerms.map((line) => <li key={line}>{line}</li>)}</ul>
        <ul>{pricingLegalCopy.graceRestricted.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Consentimiento marketing separado</h3>
        <ul>{pricingLegalCopy.marketingConsent.map((line) => <li key={line}>{line}</li>)}</ul>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
          Entiendo que marketing es opt-in separado
        </label>
      </section>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </main>
  );
}

