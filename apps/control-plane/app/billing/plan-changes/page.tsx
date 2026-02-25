"use client";

import { useState } from "react";

export default function BillingPlanChangesSupportPage() {
  const apiUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3005";
  const [installations, setInstallations] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    instanceId: "",
    action: "UPGRADE",
    targetTier: "C2",
    note: "",
  });

  async function load() {
    const res = await fetch(`${apiUrl}/api/billing/plan-changes/support`, { credentials: "include" });
    if (!res.ok) return setMessage("No autorizado");
    const data = await res.json();
    setInstallations(data.installations ?? []);
    setAudits(data.audits ?? []);
    setMessage(null);
  }

  async function submit() {
    const res = await fetch(`${apiUrl}/api/billing/plan-changes/support`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Error");
      return;
    }
    setMessage("Cambio programado (auditado en control-plane)");
    await load();
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Support Plan Changes</h1>
      <p>Programa upgrades/downgrades/cancelaciones con auditoria en control-plane.</p>
      <button onClick={load}>Cargar</button>
      {message ? <p>{message}</p> : null}

      <section style={{ marginTop: 16 }}>
        <h2>Programar cambio</h2>
        <input
          placeholder="instanceId"
          list="instances"
          value={form.instanceId}
          onChange={(e) => setForm({ ...form, instanceId: e.target.value })}
        />
        <datalist id="instances">
          {installations.map((it) => (
            <option key={it.instanceId} value={it.instanceId}>
              {it.clientName ?? it.domain ?? it.instanceId}
            </option>
          ))}
        </datalist>
        <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
          <option value="UPGRADE">UPGRADE</option>
          <option value="DOWNGRADE">DOWNGRADE</option>
          <option value="CANCEL">CANCEL</option>
          <option value="REACTIVATE">REACTIVATE</option>
        </select>
        <select value={form.targetTier} onChange={(e) => setForm({ ...form, targetTier: e.target.value })}>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
          <option value="C3">C3</option>
        </select>
        <input placeholder="nota" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button onClick={submit}>Guardar</button>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Auditoria reciente</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Fecha</th>
              <th align="left">Instancia</th>
              <th align="left">Accion</th>
              <th align="left">Target</th>
              <th align="left">Hash</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.capturedAt).toLocaleString()}</td>
                <td>{row.installation?.instanceId ?? row.installationId}</td>
                <td>{String(row.payload?.action ?? "-")}</td>
                <td>{String(row.payload?.targetTier ?? "-")}</td>
                <td style={{ fontFamily: "monospace" }}>{String(row.payloadHash).slice(0, 16)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

