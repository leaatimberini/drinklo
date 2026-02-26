"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_CONDITIONS = JSON.stringify([
  { field: "cart.ageMinutes", op: ">", value: 30 },
], null, 2);

const DEFAULT_ACTION_CONFIG = JSON.stringify({ templateId: "" }, null, 2);

export default function AutomationPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [flows, setFlows] = useState<unknown[]>([]);
  const [triggers, setTriggers] = useState<unknown[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<unknown | null>(null);
  const [metrics, setMetrics] = useState<unknown[]>([]);
  const [newFlow, setNewFlow] = useState({ name: "", triggerId: "", frequencyCap: 1, quietStart: "22:00", quietEnd: "08:00", consentRequired: true, conditions: DEFAULT_CONDITIONS });
  const [triggerForm, setTriggerForm] = useState({ type: "CART_ABANDONED", config: JSON.stringify({ windowMinutes: 30 }, null, 2) });
  const [actionForm, setActionForm] = useState({ type: "EMAIL", delayMinutes: 0, position: 0, config: DEFAULT_ACTION_CONFIG });
  const [testRecipient, setTestRecipient] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  async function loadData() {
    if (!token) return;
    const [flowRes, triggerRes] = await Promise.all([
      fetch(`${apiUrl}/admin/automation/flows`, { headers }),
      fetch(`${apiUrl}/admin/automation/triggers`, { headers }),
    ]);
    if (flowRes.ok) setFlows(await flowRes.json());
    if (triggerRes.ok) setTriggers(await triggerRes.json());
  }

  async function loadMetrics(flowId: string) {
    const res = await fetch(`${apiUrl}/admin/automation/flows/${flowId}/metrics`, { headers });
    if (res.ok) setMetrics(await res.json());
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function createTrigger() {
    setMessage(null);
    try {
      const config = JSON.parse(triggerForm.config || "{}");
      const res = await fetch(`${apiUrl}/admin/automation/triggers`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: triggerForm.type, config }),
      });
      if (!res.ok) throw new Error("No se pudo crear el trigger");
      const trigger = await res.json();
      setTriggers((prev) => [trigger, ...prev]);
    } catch (err: unknown) {
      setMessage(err.message ?? "Error");
    }
  }

  async function createFlow() {
    setMessage(null);
    try {
      const settings = {
        conditions: JSON.parse(newFlow.conditions || "[]"),
        guardrails: {
          frequencyCapPerDay: Number(newFlow.frequencyCap ?? 1),
          quietHours: { start: newFlow.quietStart, end: newFlow.quietEnd },
          consentRequired: Boolean(newFlow.consentRequired),
        },
      };
      const res = await fetch(`${apiUrl}/admin/automation/flows`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newFlow.name, triggerId: newFlow.triggerId, status: "ACTIVE", settings }),
      });
      if (!res.ok) throw new Error("No se pudo crear el flow");
      const flow = await res.json();
      setFlows((prev) => [flow, ...prev]);
      setSelectedFlow(flow);
    } catch (err: unknown) {
      setMessage(err.message ?? "Error");
    }
  }

  async function addAction() {
    if (!selectedFlow) return;
    setMessage(null);
    try {
      const config = JSON.parse(actionForm.config || "{}");
      const res = await fetch(`${apiUrl}/admin/automation/flows/${selectedFlow.id}/actions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: actionForm.type,
          delayMinutes: Number(actionForm.delayMinutes ?? 0),
          position: Number(actionForm.position ?? 0),
          config,
        }),
      });
      if (!res.ok) throw new Error("No se pudo agregar acci�n");
      await loadData();
    } catch (err: unknown) {
      setMessage(err.message ?? "Error");
    }
  }

  async function runTest() {
    if (!selectedFlow) return;
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/automation/flows/${selectedFlow.id}/test-run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ recipient: testRecipient, customerId: testRecipient ? testRecipient : undefined }),
    });
    const payload = await res.json();
    setMessage(JSON.stringify(payload, null, 2));
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontFamily: "var(--font-heading)" }}>Automatizaciones</h1>
      <p style={{ color: "#555" }}>Guardrails: frequency cap + quiet hours BA + consentimiento.</p>

      <section style={{ marginTop: 16, maxWidth: 520 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" style={{ marginTop: 6 }} />
        </label>
        <button onClick={loadData} disabled={!token}>Cargar</button>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 12, maxWidth: 720 }}>
        <h2>Nuevo trigger</h2>
        <select value={triggerForm.type} onChange={(e) => setTriggerForm({ ...triggerForm, type: e.target.value })}>
          <option value="CART_ABANDONED">Carrito abandonado</option>
          <option value="POST_PURCHASE">Post-compra</option>
          <option value="BIRTHDAY">Cumplea�os</option>
          <option value="STOCK_BACK">Stock-back</option>
          <option value="WINBACK">Winback</option>
        </select>
        <label>
          Config (JSON)
          <textarea rows={4} value={triggerForm.config} onChange={(e) => setTriggerForm({ ...triggerForm, config: e.target.value })} />
        </label>
        <button onClick={createTrigger} disabled={!token}>Crear trigger</button>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 12, maxWidth: 720 }}>
        <h2>Nuevo flow</h2>
        <input placeholder="Nombre" value={newFlow.name} onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })} />
        <select value={newFlow.triggerId} onChange={(e) => setNewFlow({ ...newFlow, triggerId: e.target.value })}>
          <option value="">Seleccionar trigger</option>
          {triggers.map((trigger) => (
            <option key={trigger.id} value={trigger.id}>{trigger.type}</option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label>
            Frequency cap (por d�a)
            <input type="number" value={newFlow.frequencyCap} onChange={(e) => setNewFlow({ ...newFlow, frequencyCap: Number(e.target.value) })} />
          </label>
          <label>
            Consent requerido
            <input type="checkbox" checked={newFlow.consentRequired} onChange={(e) => setNewFlow({ ...newFlow, consentRequired: e.target.checked })} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label>
            Quiet hours start
            <input value={newFlow.quietStart} onChange={(e) => setNewFlow({ ...newFlow, quietStart: e.target.value })} />
          </label>
          <label>
            Quiet hours end
            <input value={newFlow.quietEnd} onChange={(e) => setNewFlow({ ...newFlow, quietEnd: e.target.value })} />
          </label>
        </div>
        <label>
          Condiciones (JSON)
          <textarea rows={6} value={newFlow.conditions} onChange={(e) => setNewFlow({ ...newFlow, conditions: e.target.value })} />
        </label>
        <button onClick={createFlow} disabled={!token || !newFlow.name || !newFlow.triggerId}>Crear flow</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Flows</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {flows.map((flow) => (
            <button key={flow.id} onClick={() => { setSelectedFlow(flow); loadMetrics(flow.id); }} style={{ textAlign: "left" }}>
              {flow.name} � {flow.status}
            </button>
          ))}
        </div>
      </section>

      {selectedFlow && (
        <section style={{ marginTop: 24, display: "grid", gap: 12, maxWidth: 720 }}>
          <h3>Editor visual - {selectedFlow.name}</h3>
          <div style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)" }}>
            <strong>Trigger:</strong> {selectedFlow.trigger?.type}
          </div>
          <div>
            <h4>Acciones</h4>
            <ul>
              {(selectedFlow.actions ?? []).map((action: unknown) => (
                <li key={action.id}>
                  {action.type} � delay {action.delayMinutes}m � pos {action.position}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <select value={actionForm.type} onChange={(e) => setActionForm({ ...actionForm, type: e.target.value })}>
              <option value="EMAIL">Email</option>
              <option value="PUSH">Push (stub)</option>
              <option value="IN_APP">In-App (stub)</option>
              <option value="TELEGRAM">Telegram (stub)</option>
              <option value="COUPON">Cup�n</option>
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input type="number" placeholder="Delay (min)" value={actionForm.delayMinutes} onChange={(e) => setActionForm({ ...actionForm, delayMinutes: Number(e.target.value) })} />
              <input type="number" placeholder="Posici�n" value={actionForm.position} onChange={(e) => setActionForm({ ...actionForm, position: Number(e.target.value) })} />
            </div>
            <label>
              Config (JSON)
              <textarea rows={4} value={actionForm.config} onChange={(e) => setActionForm({ ...actionForm, config: e.target.value })} />
            </label>
            <button onClick={addAction}>Agregar acci�n</button>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Test run</h4>
            <input placeholder="Email/recipient" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} />
            <button onClick={runTest} disabled={!testRecipient}>Ejecutar test</button>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>M�tricas</h4>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Fecha</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Envios</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Aperturas</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>Conversiones</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.id}>
                    <td>{String(row.date).slice(0, 10)}</td>
                    <td>{row.sent}</td>
                    <td>{row.opened}</td>
                    <td>{row.converted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {message && (
        <section style={{ marginTop: 16 }}>
          <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
        </section>
      )}
    </main>
  );
}
