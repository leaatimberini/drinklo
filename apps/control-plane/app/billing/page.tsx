"use client";

import { useEffect, useState } from "react";

export default function BillingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3005";
  const [token, setToken] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ name: "", price: 0, currency: "ARS", period: "MONTHLY", features: "" });
  const [accountForm, setAccountForm] = useState({ instanceId: "", planId: "", email: "", clientName: "" });

  async function loadAll() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/api/billing`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setMessage("No autorizado");
      return;
    }
    const data = await res.json();
    setPlans(data.plans ?? []);
    setAccounts(data.accounts ?? []);
  }

  async function createPlan() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/api/billing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "plan",
        name: planForm.name,
        price: Number(planForm.price),
        currency: planForm.currency,
        period: planForm.period,
        features: planForm.features.split(",").map((f) => f.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) return setMessage("Error creando plan");
    await loadAll();
  }

  async function createAccount() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/api/billing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "account",
        instanceId: accountForm.instanceId,
        planId: accountForm.planId,
        email: accountForm.email,
        clientName: accountForm.clientName,
      }),
    });
    if (!res.ok) return setMessage("Error creando cuenta");
    await loadAll();
  }

  return (
    <main>
      <h1>Billing Provider</h1>
      <p>Administra planes y suscripciones.</p>

      <label>
        Token admin
        <input value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <button onClick={loadAll}>Cargar</button>
      {message && <p>{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Nuevo plan</h2>
        <input placeholder="Nombre" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
        <input type="number" placeholder="Precio" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })} />
        <input placeholder="Moneda" value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })} />
        <select value={planForm.period} onChange={(e) => setPlanForm({ ...planForm, period: e.target.value })}>
          <option value="MONTHLY">Mensual</option>
          <option value="YEARLY">Anual</option>
        </select>
        <input placeholder="Features (comma)" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} />
        <button onClick={createPlan}>Crear plan</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Nueva cuenta</h2>
        <input placeholder="Instance ID" value={accountForm.instanceId} onChange={(e) => setAccountForm({ ...accountForm, instanceId: e.target.value })} />
        <select value={accountForm.planId} onChange={(e) => setAccountForm({ ...accountForm, planId: e.target.value })}>
          <option value="">Plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
        <input placeholder="Email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} />
        <input placeholder="Cliente" value={accountForm.clientName} onChange={(e) => setAccountForm({ ...accountForm, clientName: e.target.value })} />
        <button onClick={createAccount}>Crear cuenta</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Cuentas</h2>
        {accounts.map((account) => (
          <div key={account.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
            <strong>{account.instanceId}</strong> - {account.status} - {account.plan?.name}
          </div>
        ))}
      </section>
    </main>
  );
}
