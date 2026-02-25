"use client";

import { useEffect, useMemo, useState } from "react";

type PlanPriceRow = {
  id: string;
  tier: string;
  billingPeriod: "MONTHLY" | "YEARLY";
  currency: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function PricingCatalogPage() {
  const apiUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010";
  const [items, setItems] = useState<PlanPriceRow[]>([]);
  const [snapshot, setSnapshot] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tier: "C1",
    billingPeriod: "MONTHLY",
    currency: "USD",
    amount: "10",
    effectiveFrom: new Date().toISOString().slice(0, 16),
    effectiveTo: "",
    notes: "",
    closeOpenOverlap: true,
  });
  const [closeForm, setCloseForm] = useState({
    id: "",
    effectiveTo: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  async function load() {
    setError(null);
    const res = await fetch(`${apiUrl}/api/pricing-catalog`, { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "No se pudo cargar pricing catalog");
      return;
    }
    setItems(payload.items ?? []);
    setSnapshot(payload.snapshot ?? []);
    setAudit(payload.audit ?? []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createPrice() {
    setError(null);
    setMessage(null);
    if (!confirm("Crear/programar precio? Se registrará auditoría.")) return;
    const res = await fetch(`${apiUrl}/api/pricing-catalog`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        tier: form.tier,
        billingPeriod: form.billingPeriod,
        currency: form.currency,
        amount: Number(form.amount),
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
        notes: form.notes || null,
        closeOpenOverlap: form.closeOpenOverlap,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "No se pudo crear precio");
      return;
    }
    setMessage(`Precio ${payload.item?.tier}/${payload.item?.currency} guardado (${payload.impact?.policy})`);
    await load();
  }

  async function closePrice() {
    setError(null);
    setMessage(null);
    if (!closeForm.id) return setError("Seleccioná un price row a cerrar");
    const res = await fetch(`${apiUrl}/api/pricing-catalog`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close",
        id: closeForm.id,
        effectiveTo: new Date(closeForm.effectiveTo).toISOString(),
        notes: closeForm.notes || null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "No se pudo cerrar precio");
      return;
    }
    setMessage(`Precio cerrado: ${payload.item?.id}`);
    await load();
  }

  const groupedSnapshot = useMemo(() => snapshot, [snapshot]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Pricing Catalog</h1>
      <p>Catálogo de precios del proveedor por tier, período y moneda (USD base / ARS referencia), con cambios programados e historial auditado.</p>
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h2>Nuevo precio / cambio programado</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <label>
            Tier
            <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
              <option value="C3">C3</option>
            </select>
          </label>
          <label>
            Billing period
            <select value={form.billingPeriod} onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}>
              <option value="MONTHLY">MONTHLY</option>
              <option value="YEARLY">YEARLY</option>
            </select>
          </label>
          <label>
            Currency
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Amount
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label>
            Effective from
            <input type="datetime-local" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </label>
          <label>
            Effective to (optional)
            <input type="datetime-local" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.closeOpenOverlap}
              onChange={(e) => setForm({ ...form, closeOpenOverlap: e.target.checked })}
            />
            Cerrar row activa previa
          </label>
        </div>
        <label style={{ display: "block", marginTop: 8 }}>
          Notes
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: "100%" }} />
        </label>
        <div style={{ marginTop: 8 }}>
          <button onClick={createPrice}>Guardar precio</button>{" "}
          <button onClick={() => load()}>Refresh</button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h2>Snapshot actual / próximo</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Tier</th>
              <th align="left">Period</th>
              <th align="left">Currency</th>
              <th align="right">Current</th>
              <th align="left">Current from</th>
              <th align="right">Next</th>
              <th align="left">Next from</th>
            </tr>
          </thead>
          <tbody>
            {groupedSnapshot.map((row: any) => (
              <tr key={`${row.tier}-${row.billingPeriod}-${row.currency}`}>
                <td>{row.tier}</td>
                <td>{row.billingPeriod}</td>
                <td>{row.currency}</td>
                <td align="right">{row.current?.amount ?? "-"}</td>
                <td>{row.current?.effectiveFrom ? new Date(row.current.effectiveFrom).toLocaleString() : "-"}</td>
                <td align="right">{row.next?.amount ?? "-"}</td>
                <td>{row.next?.effectiveFrom ? new Date(row.next.effectiveFrom).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h2>Historial (PlanPrice)</h2>
        <div style={{ marginBottom: 8 }}>
          <label>
            Cerrar row seleccionada
            <select value={closeForm.id} onChange={(e) => setCloseForm({ ...closeForm, id: e.target.value })} style={{ marginLeft: 8 }}>
              <option value="">-- seleccionar --</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.tier}/{item.billingPeriod}/{item.currency} {item.amount} ({item.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </label>
          <input
            type="datetime-local"
            value={closeForm.effectiveTo}
            onChange={(e) => setCloseForm({ ...closeForm, effectiveTo: e.target.value })}
            style={{ marginLeft: 8 }}
          />
          <input
            placeholder="nota"
            value={closeForm.notes}
            onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
            style={{ marginLeft: 8 }}
          />
          <button onClick={closePrice} style={{ marginLeft: 8 }}>
            Cerrar
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Tier</th>
              <th align="left">Period</th>
              <th align="left">Cur</th>
              <th align="right">Amount</th>
              <th align="left">From</th>
              <th align="left">To</th>
              <th align="left">Notes</th>
              <th align="left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.tier}</td>
                <td>{item.billingPeriod}</td>
                <td>{item.currency}</td>
                <td align="right">{item.amount}</td>
                <td>{new Date(item.effectiveFrom).toLocaleString()}</td>
                <td>{item.effectiveTo ? new Date(item.effectiveTo).toLocaleString() : "-"}</td>
                <td>{item.notes ?? "-"}</td>
                <td>{new Date(item.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2>Auditoría</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Fecha</th>
              <th align="left">Tipo</th>
              <th align="left">Actor</th>
              <th align="left">Hash</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.capturedAt).toLocaleString()}</td>
                <td>{row.evidenceType}</td>
                <td>{row.capturedBy ?? "-"}</td>
                <td style={{ fontFamily: "monospace" }}>{String(row.payloadHash).slice(0, 16)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

