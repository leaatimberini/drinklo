"use client";

import { useEffect, useMemo, useState } from "react";

type BulkAction = {
  id: string;
  actionType: string;
  status: string;
  requestedByRole: string;
  requestedByActor?: string | null;
  approvalsNeeded: number;
  requiresTwoPersonApproval: boolean;
  approvedByRoles: string[];
  targetCount: number;
  manifestHash: string;
  note?: string | null;
  error?: string | null;
  payload: any;
  result?: any;
  createdAt: string;
  approvedAt?: string | null;
  executedAt?: string | null;
  approvals?: Array<{
    id: string;
    approverRole: string;
    approverActor?: string | null;
    decision: string;
    note?: string | null;
    createdAt: string;
  }>;
};

export default function BillingBulkOpsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3005";
  const [role, setRole] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [actions, setActions] = useState<BulkAction[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    actionType: "SET_TIER",
    targetTier: "C2",
    trialExtensionDays: "7",
    campaignId: "",
    instanceIdsText: "",
    reason: "",
    requireTwoPersonApproval: false,
  });

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`${apiUrl}/api/billing/bulk-ops`, { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? "failed to load");
      return;
    }
    setRole(payload.role ?? null);
    setCampaigns(payload.campaigns ?? []);
    setActions(payload.actions ?? []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const parsedInstanceIds = useMemo(
    () =>
      Array.from(
        new Set(
          form.instanceIdsText
            .split(/[\s,]+/)
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ),
    [form.instanceIdsText],
  );

  async function createAction() {
    setError(null);
    setMessage(null);
    if (!confirm("Confirmar creación de acción masiva? Se registrará auditoría firmada.")) return;
    const body: any = {
      action: "create",
      confirmed: true,
      actionType: form.actionType,
      instanceIds: parsedInstanceIds,
      campaignId: form.campaignId || null,
      reason: form.reason || null,
      requireTwoPersonApproval: form.requireTwoPersonApproval,
    };
    if (form.actionType === "SET_TIER") body.targetTier = form.targetTier;
    if (form.actionType === "EXTEND_TRIAL") body.trialExtensionDays = Number(form.trialExtensionDays);

    const res = await fetch(`${apiUrl}/api/billing/bulk-ops`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "failed to create action");
      return;
    }
    setMessage(`Acción creada (${payload.action?.status}) · targets=${payload.action?.targetCount}`);
    await load();
  }

  async function actOnAction(id: string, action: "approve" | "reject" | "execute") {
    setBusyId(id);
    setError(null);
    setMessage(null);
    if (action === "reject" && !confirm("Rechazar acción masiva?")) {
      setBusyId(null);
      return;
    }
    if (action === "execute" && !confirm("Ejecutar acción masiva ahora?")) {
      setBusyId(null);
      return;
    }
    const res = await fetch(`${apiUrl}/api/billing/bulk-ops/${encodeURIComponent(id)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        note: action === "reject" ? "rejected from UI" : null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(payload.error ?? `failed to ${action}`);
      return;
    }
    setMessage(`Acción ${action} OK`);
    await load();
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Billing Bulk Ops</h1>
      <p>Operaciones masivas de billing/trial/fraude con aprobación opcional de dos personas y auditoría firmada.</p>
      <p>Rol actual: {role ?? "-"}</p>
      {loading ? <p>Cargando...</p> : null}
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Nueva acción masiva</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <label>
            Tipo
            <select value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              <option value="SET_TIER">SET_TIER</option>
              <option value="EXTEND_TRIAL">EXTEND_TRIAL</option>
              <option value="FRAUD_PAUSE">FRAUD_PAUSE</option>
              <option value="FRAUD_CANCEL">FRAUD_CANCEL</option>
            </select>
          </label>

          {form.actionType === "SET_TIER" ? (
            <label>
              Tier destino
              <select value={form.targetTier} onChange={(e) => setForm({ ...form, targetTier: e.target.value })}>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
                <option value="C3">C3</option>
              </select>
            </label>
          ) : null}

          {form.actionType === "EXTEND_TRIAL" ? (
            <label>
              Días extensión
              <input
                value={form.trialExtensionDays}
                onChange={(e) => setForm({ ...form, trialExtensionDays: e.target.value })}
              />
            </label>
          ) : null}

          <label>
            Campaña trial (opcional)
            <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">(sin campaña)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.tier}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.requireTwoPersonApproval}
              onChange={(e) => setForm({ ...form, requireTwoPersonApproval: e.target.checked })}
            />
            Requerir 2-person approval
          </label>
        </div>

        <label style={{ display: "block", marginTop: 8 }}>
          Instance IDs (coma/espacio/nueva línea; opcional si usa campaña)
          <textarea
            rows={4}
            value={form.instanceIdsText}
            onChange={(e) => setForm({ ...form, instanceIdsText: e.target.value })}
            style={{ width: "100%" }}
          />
        </label>

        <label style={{ display: "block", marginTop: 8 }}>
          Motivo / evidencia
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={{ width: "100%" }} />
        </label>

        <p style={{ fontSize: 12, opacity: 0.85 }}>
          Preview targets manuales: {parsedInstanceIds.length}. Para acciones por campaña, los targets finales se resuelven al crear.
        </p>
        <button onClick={createAction}>Crear acción</button>{" "}
        <button onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </section>

      <section className="card">
        <h2>Acciones recientes</h2>
        {actions.length === 0 ? <p>Sin acciones masivas.</p> : null}
        {actions.map((item) => {
          const resolvedTargets = Array.isArray(item.payload?.resolvedInstanceIds) ? item.payload.resolvedInstanceIds.length : 0;
          const approvals = item.approvals ?? [];
          return (
            <div key={item.id} style={{ borderTop: "1px solid #eee", padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div>
                    <strong>{item.actionType}</strong> · {item.status} · targets={item.targetCount || resolvedTargets}
                  </div>
                  <div>
                    req: {item.requestedByRole}
                    {item.requestedByActor ? ` (${item.requestedByActor})` : ""} · approvals {approvals.filter((a) => a.decision === "APPROVE").length}/
                    {item.approvalsNeeded}
                    {item.requiresTwoPersonApproval ? " · 2-person" : ""}
                  </div>
                  <div>
                    created {new Date(item.createdAt).toLocaleString()}
                    {item.approvedAt ? ` · approved ${new Date(item.approvedAt).toLocaleString()}` : ""}
                    {item.executedAt ? ` · executed ${new Date(item.executedAt).toLocaleString()}` : ""}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>hash {item.manifestHash.slice(0, 20)}...</div>
                  {item.note ? <div>note: {item.note}</div> : null}
                  {item.error ? <div style={{ color: "crimson" }}>error: {item.error}</div> : null}
                </div>
                <div>
                  <button disabled={busyId === item.id} onClick={() => actOnAction(item.id, "approve")}>
                    Aprobar
                  </button>{" "}
                  <button disabled={busyId === item.id} onClick={() => actOnAction(item.id, "reject")}>
                    Rechazar
                  </button>{" "}
                  <button disabled={busyId === item.id} onClick={() => actOnAction(item.id, "execute")}>
                    Ejecutar
                  </button>
                </div>
              </div>
              <details style={{ marginTop: 8 }}>
                <summary>Manifest / payload / resultado / approvals</summary>
                <pre style={{ background: "#f6f6f6", padding: 8, overflow: "auto" }}>
                  {JSON.stringify(
                    {
                      manifest: item.payload?.manifest ?? null,
                      payload: item.payload,
                      result: item.result,
                      approvals,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          );
        })}
      </section>
    </main>
  );
}

