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
    cancelAtPeriodEnd?: boolean;
    softLimited?: boolean;
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
  lifecycleBanners?: Array<{
    kind: string;
    severity: "info" | "warning" | "danger";
    title: string;
    message: string;
  }>;
  restrictedPolicy?: {
    variant?: "CATALOG_ONLY" | "ALLOW_BASIC_SALES";
    keepsData: boolean;
    basicSalesAllowed: boolean;
    blockedActions: string[];
    degradedActions: string[];
    developerApiRestrictedRateLimitPerMin?: number;
  };
};

export default function PlanBillingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<any[]>([]);
  const [data, setData] = useState<EntitlementsResponse | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [targetTier, setTargetTier] = useState("C2");
  const [changePreview, setChangePreview] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [restrictedVariant, setRestrictedVariant] = useState<"CATALOG_ONLY" | "ALLOW_BASIC_SALES">("ALLOW_BASIC_SALES");

  async function load() {
    setMessage(null);
    const headers = { Authorization: `Bearer ${token}` };
    const [catalogRes, entitlementsRes, notificationsRes] = await Promise.all([
      fetch(`${apiUrl}/admin/plans/catalog`, { headers }),
      fetch(`${apiUrl}/admin/plans/entitlements`, { headers }),
      fetch(`${apiUrl}/admin/plans/lifecycle/notifications?limit=10`, { headers }),
    ]);
    if (!catalogRes.ok || !entitlementsRes.ok) {
      setMessage("No se pudo cargar informacion del plan");
      return;
    }
    setCatalog(await catalogRes.json());
    const entitlementsPayload = await entitlementsRes.json();
    setData(entitlementsPayload);
    const variant = entitlementsPayload?.restrictedPolicy?.variant;
    if (variant === "CATALOG_ONLY" || variant === "ALLOW_BASIC_SALES") {
      setRestrictedVariant(variant);
    }
    setNotifications(notificationsRes.ok ? await notificationsRes.json() : []);
  }

  async function saveRestrictedVariant() {
    const res = await fetch(`${apiUrl}/admin/plans/restricted-mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ variant: restrictedVariant }),
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Variante restricted actualizada: ${payload.restrictedModeVariant ?? restrictedVariant}` : payload.error ?? "No se pudo actualizar variante restricted");
    if (res.ok) await load();
  }

  async function previewPlanChange(kind: "upgrade" | "downgrade") {
    setMessage(null);
    setChangePreview(null);
    const res = await fetch(`${apiUrl}/billing/${kind}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetTier, dryRun: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(payload.error ?? `No se pudo previsualizar ${kind}`);
      return;
    }
    setChangePreview({ kind, ...payload });
  }

  async function applyPlanChange(kind: "upgrade" | "downgrade") {
    const preview = changePreview ?? null;
    const confirmText =
      kind === "upgrade"
        ? `Confirmar upgrade a ${targetTier}${preview?.proration ? ` (total prorrateo ARS ${preview.proration.total})` : ""}?`
        : `Confirmar downgrade programado a ${targetTier} para proximo ciclo?`;
    if (!window.confirm(confirmText)) return;
    const res = await fetch(`${apiUrl}/billing/${kind}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetTier, dryRun: false }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setMessage(payload.error ?? `No se pudo aplicar ${kind}`);
      return;
    }
    setMessage(kind === "upgrade" ? "Upgrade aplicado" : "Downgrade programado");
    await load();
  }

  async function scheduleCancel() {
    const res = await fetch(`${apiUrl}/billing/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dryRun: false }),
    });
    setMessage(res.ok ? "Cancelacion programada para fin de ciclo" : "No se pudo programar cancelacion");
    if (res.ok) await load();
  }

  async function reactivate() {
    const res = await fetch(`${apiUrl}/billing/reactivate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    setMessage(res.ok ? "Suscripcion reactivada" : "No se pudo reactivar");
    if (res.ok) await load();
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

      {data?.lifecycleBanners?.map((banner) => (
        <div
          key={banner.kind}
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: "var(--radius-md)",
            border: "1px solid",
            borderColor:
              banner.severity === "danger"
                ? "#dc2626"
                : banner.severity === "warning"
                  ? "#d97706"
                  : "#2563eb",
            background:
              banner.severity === "danger"
                ? "#fef2f2"
                : banner.severity === "warning"
                  ? "#fffbeb"
                  : "#eff6ff",
          }}
        >
          <strong>{banner.title}</strong>
          <div>{banner.message}</div>
        </div>
      ))}

      {data && (
        <>
          <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}>
            <h2 style={{ marginTop: 0 }}>Cambiar plan</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label>
                Target tier
                <select value={targetTier} onChange={(e) => setTargetTier(e.target.value)}>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                  <option value="C3">C3</option>
                </select>
              </label>
              <button onClick={() => previewPlanChange("upgrade")}>Preview upgrade</button>
              <button onClick={() => previewPlanChange("downgrade")}>Preview downgrade</button>
              <button onClick={() => applyPlanChange("upgrade")}>Aplicar upgrade</button>
              <button onClick={() => applyPlanChange("downgrade")}>Programar downgrade</button>
              <button onClick={scheduleCancel}>Cancelar fin de ciclo</button>
              <button onClick={reactivate}>Reactivar</button>
            </div>
            {changePreview ? (
              <div style={{ marginTop: 12 }}>
                <strong>Confirm modal (preview)</strong>
                <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(changePreview, null, 2)}</pre>
              </div>
            ) : null}
            {data.subscription.nextTier ? (
              <p style={{ marginTop: 12 }}>
                Cambio programado: downgrade a <strong>{data.subscription.nextTier}</strong> en{" "}
                {new Date(data.subscription.currentPeriodEnd).toLocaleString()}
              </p>
            ) : null}
          </section>

          <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}>
            <h2 style={{ marginTop: 0 }}>Resumen</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>
              <div><strong>Estado:</strong> {data.subscription.status}</div>
              <div><strong>Tier actual:</strong> {data.subscription.currentTier}</div>
              <div><strong>Proximo tier:</strong> {data.subscription.nextTier ?? "-"}</div>
              <div><strong>Cancel fin ciclo:</strong> {String((data.subscription as any).cancelAtPeriodEnd ?? false)}</div>
              <div><strong>Periodo actual:</strong> {new Date(data.subscription.currentPeriodStart).toLocaleString()} - {new Date(data.subscription.currentPeriodEnd).toLocaleString()}</div>
              <div><strong>Trial hasta:</strong> {data.subscription.trialEndAt ? new Date(data.subscription.trialEndAt).toLocaleString() : "-"}</div>
              <div><strong>Timezone:</strong> {data.timezone ?? "America/Argentina/Buenos_Aires"}</div>
              <div><strong>Soft limit:</strong> {String((data.subscription as any).softLimited ?? false)}</div>
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
            {data.restrictedPolicy ? (
              <div style={{ marginTop: 12 }}>
                <strong>Politica restricted (preview)</strong>
                <div>
                  Variante: <strong>{data.restrictedPolicy.variant ?? "ALLOW_BASIC_SALES"}</strong> | Conserva datos:{" "}
                  {String(data.restrictedPolicy.keepsData)} | Ventas basicas: {String(data.restrictedPolicy.basicSalesAllowed)}
                </div>
                <div>API pública rate limit duro (/min): {data.restrictedPolicy.developerApiRestrictedRateLimitPerMin ?? 30}</div>
                <div>Bloqueos: {data.restrictedPolicy.blockedActions.join(", ")}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label>
                    Variante provider
                    <select value={restrictedVariant} onChange={(e) => setRestrictedVariant(e.target.value as any)}>
                      <option value="ALLOW_BASIC_SALES">allow-basic-sales</option>
                      <option value="CATALOG_ONLY">catalog-only</option>
                    </select>
                  </label>
                  <button onClick={saveRestrictedVariant}>Guardar variante</button>
                </div>
                {data.subscription.status === "RESTRICTED" ? (
                  <div style={{ marginTop: 8, color: "#b91c1c" }}>
                    Modo RESTRICTED activo. Algunas acciones de edición fallarán con explicación y CTA para upgrade.
                  </div>
                ) : null}
              </div>
            ) : null}
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
              <th align="right">Precio ARS/mes</th>
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
                <td align="right">{item.monthlyPriceArs ?? 0}</td>
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

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>Notificaciones lifecycle recientes</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Canal</th>
              <th align="left">Tipo</th>
              <th align="left">Destino</th>
              <th align="left">Estado</th>
              <th align="left">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((item) => (
              <tr key={item.id}>
                <td>{item.channel}</td>
                <td>{item.kind}</td>
                <td>{item.recipient ?? "-"}</td>
                <td>{item.status}</td>
                <td>{item.sentAt ? new Date(item.sentAt).toLocaleString() : new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </main>
  );
}
