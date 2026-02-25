"use client";

import { useEffect, useMemo, useState } from "react";

type CampaignItem = {
  id: string;
  code: string;
  tier: "C1" | "C2";
  durationDays: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  requiresApproval: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  notes: string | null;
  status: "ACTIVE" | "REVOKED";
  signupLink: string;
  metrics: {
    redemptions: number;
    activeTrials: number;
    conversionsPaid: number;
    earlyChurn: number;
    statuses: Record<string, number>;
  };
};

export default function TrialCampaignsPage() {
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: "",
    tier: "C1",
    durationDays: "30",
    maxRedemptions: "",
    expiresAt: "",
    requiresApproval: false,
    allowedDomains: "",
    blockedDomains: "",
    notes: "",
  });
  const [extendForm, setExtendForm] = useState({
    billingAccountId: "",
    campaignId: "",
    days: "7",
    reason: "",
  });
  const [editForm, setEditForm] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/trial-campaigns");
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? "failed to load campaigns");
      return;
    }
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createCampaign() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/trial-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        code: form.code,
        tier: form.tier,
        durationDays: Number(form.durationDays),
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        expiresAt: form.expiresAt || null,
        requiresApproval: form.requiresApproval,
        allowedDomains: form.allowedDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        blockedDomains: form.blockedDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        notes: form.notes || null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to create campaign");
      return;
    }
    setMessage(`Campaña ${payload.code} creada`);
    setForm((prev) => ({ ...prev, code: "", notes: "" }));
    await load();
  }

  async function revokeCampaign(id: string) {
    if (!confirm("Revocar campaña?")) return;
    setError(null);
    setMessage(null);
    const res = await fetch("/api/trial-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to revoke");
      return;
    }
    setMessage("Campaña revocada");
    await load();
  }

  async function saveEdit() {
    if (!editForm?.id) return;
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/trial-campaigns/${encodeURIComponent(editForm.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationDays: Number(editForm.durationDays),
        maxRedemptions: editForm.maxRedemptions === "" ? null : Number(editForm.maxRedemptions),
        expiresAt: editForm.expiresAt || null,
        requiresApproval: Boolean(editForm.requiresApproval),
        allowedDomains: String(editForm.allowedDomains || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        blockedDomains: String(editForm.blockedDomains || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        notes: editForm.notes || null,
        status: editForm.status,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to update campaign");
      return;
    }
    setMessage(`Campaña ${payload.code} actualizada`);
    setEditForm(null);
    await load();
  }

  async function extendTrial() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/trial-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "extendTrial",
        campaignId: extendForm.campaignId || null,
        billingAccountId: extendForm.billingAccountId,
        days: Number(extendForm.days),
        reason: extendForm.reason || null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to extend trial");
      return;
    }
    setMessage(`Trial extendido hasta ${new Date(payload.trialEndsAt).toLocaleString()}`);
    setExtendForm((prev) => ({ ...prev, billingAccountId: "", reason: "" }));
    await load();
  }

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.redemptions += item.metrics.redemptions || 0;
          acc.activeTrials += item.metrics.activeTrials || 0;
          acc.conversionsPaid += item.metrics.conversionsPaid || 0;
          acc.earlyChurn += item.metrics.earlyChurn || 0;
          return acc;
        },
        { redemptions: 0, activeTrials: 0, conversionsPaid: 0, earlyChurn: 0 },
      ),
    [items],
  );

  return (
    <main>
      <h1>Trial Campaigns</h1>
      <p>Campañas de trial del proveedor (C1/C2), redemptions, anti-abuso y extensión manual auditada.</p>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {message ? <p style={{ color: "green" }}>{message}</p> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Resumen</h2>
        <p>
          Campañas: {items.length} · Redemptions: {totals.redemptions} · Trials activos: {totals.activeTrials} · Conversiones pago:{" "}
          {totals.conversionsPaid} · Churn temprano: {totals.earlyChurn}
        </p>
        <button onClick={() => load()} disabled={loading}>
          {loading ? "Cargando..." : "Refresh"}
        </button>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Nueva campaña</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <label>
            Code
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </label>
          <label>
            Tier
            <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as "C1" | "C2" })}>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </label>
          <label>
            Duración (días)
            <input value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
          </label>
          <label>
            Max redemptions
            <input value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
          </label>
          <label>
            Expira (UTC)
            <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
            />
            Requiere aprobación
          </label>
        </div>
        <label>
          Allowed domains (coma)
          <input value={form.allowedDomains} onChange={(e) => setForm({ ...form, allowedDomains: e.target.value })} />
        </label>
        <label>
          Blocked domains (coma)
          <input value={form.blockedDomains} onChange={(e) => setForm({ ...form, blockedDomains: e.target.value })} />
        </label>
        <label>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button onClick={createCampaign}>Crear campaña</button>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Extender trial (manual, auditado)</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <label>
            BillingAccountId
            <input
              value={extendForm.billingAccountId}
              onChange={(e) => setExtendForm({ ...extendForm, billingAccountId: e.target.value })}
            />
          </label>
          <label>
            CampaignId (opcional)
            <input value={extendForm.campaignId} onChange={(e) => setExtendForm({ ...extendForm, campaignId: e.target.value })} />
          </label>
          <label>
            Días
            <input value={extendForm.days} onChange={(e) => setExtendForm({ ...extendForm, days: e.target.value })} />
          </label>
        </div>
        <label>
          Reason
          <input value={extendForm.reason} onChange={(e) => setExtendForm({ ...extendForm, reason: e.target.value })} />
        </label>
        <button onClick={extendTrial}>Extender</button>
      </section>

      {editForm ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>Editar campaña: {editForm.code}</h2>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <label>
              Duración (días)
              <input
                value={editForm.durationDays}
                onChange={(e) => setEditForm({ ...editForm, durationDays: e.target.value })}
              />
            </label>
            <label>
              Max redemptions
              <input
                value={editForm.maxRedemptions}
                onChange={(e) => setEditForm({ ...editForm, maxRedemptions: e.target.value })}
              />
            </label>
            <label>
              Expira (UTC)
              <input
                type="datetime-local"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
              />
            </label>
            <label>
              Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVOKED">REVOKED</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(editForm.requiresApproval)}
                onChange={(e) => setEditForm({ ...editForm, requiresApproval: e.target.checked })}
              />
              Requiere aprobación
            </label>
          </div>
          <label>
            Allowed domains (coma)
            <input value={editForm.allowedDomains} onChange={(e) => setEditForm({ ...editForm, allowedDomains: e.target.value })} />
          </label>
          <label>
            Blocked domains (coma)
            <input value={editForm.blockedDomains} onChange={(e) => setEditForm({ ...editForm, blockedDomains: e.target.value })} />
          </label>
          <label>
            Notes
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveEdit}>Guardar cambios</button>
            <button onClick={() => setEditForm(null)}>Cancelar</button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2>Campañas</h2>
        {items.map((item) => (
          <div key={item.id} style={{ borderTop: "1px solid #eee", padding: "12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>{item.code}</strong> · {item.tier} · {item.status}
                <div>
                  duración {item.durationDays}d · max {item.maxRedemptions ?? "∞"} · expires{" "}
                  {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "none"}
                </div>
                <div>link: <a href={item.signupLink} target="_blank">{item.signupLink}</a></div>
              </div>
              <div>
                <button
                  onClick={() =>
                    setEditForm({
                      id: item.id,
                      code: item.code,
                      durationDays: String(item.durationDays),
                      maxRedemptions: item.maxRedemptions == null ? "" : String(item.maxRedemptions),
                      expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
                      requiresApproval: item.requiresApproval,
                      allowedDomains: (item.allowedDomains ?? []).join(", "),
                      blockedDomains: (item.blockedDomains ?? []).join(", "),
                      notes: item.notes ?? "",
                      status: item.status,
                    })
                  }
                >
                  Editar
                </button>{" "}
                {item.status === "ACTIVE" ? <button onClick={() => revokeCampaign(item.id)}>Revocar</button> : null}
              </div>
            </div>
            <div style={{ marginTop: 6 }}>
              redemptions {item.metrics.redemptions} · trials activos {item.metrics.activeTrials} · conversiones pago{" "}
              {item.metrics.conversionsPaid} · churn temprano {item.metrics.earlyChurn}
            </div>
            <details style={{ marginTop: 6 }}>
              <summary>Detalles</summary>
              <pre style={{ background: "#f6f6f6", padding: 8, overflow: "auto" }}>
                {JSON.stringify(
                  {
                    requiresApproval: item.requiresApproval,
                    allowedDomains: item.allowedDomains,
                    blockedDomains: item.blockedDomains,
                    notes: item.notes,
                    statuses: item.metrics.statuses,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
        ))}
        {items.length === 0 ? <p>Sin campañas cargadas.</p> : null}
      </section>
    </main>
  );
}
