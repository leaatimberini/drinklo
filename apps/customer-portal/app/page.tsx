"use client";

import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
};

type HealthLog = {
  provider: string;
  status: string;
  message?: string | null;
  checkedAt: string;
};

type Incident = {
  id: string;
  title: string;
  status: string;
  severity: string;
  startedAt: string;
};

export default function PortalPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const controlPlaneUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3005";
  const portalToken = process.env.NEXT_PUBLIC_BILLING_PORTAL_TOKEN ?? "";
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [health, setHealth] = useState<HealthLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [billingInstanceId, setBillingInstanceId] = useState("");
  const [billingData, setBillingData] = useState<any | null>(null);
  const [targetPlanId, setTargetPlanId] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("portal_token");
    if (stored) setToken(stored);
  }, []);

  async function login() {
    setLoginError(null);
    const res = await fetch(`${apiUrl}/portal/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, companyId: companyId || undefined }),
    });
    const data = await res.json();
    if (!data.ok) {
      setLoginError("Credenciales invalidas");
      return;
    }
    setToken(data.token);
    window.localStorage.setItem("portal_token", data.token);
    await loadAll(data.token);
  }

  async function loadAll(tokenValue?: string) {
    const auth = { Authorization: `Bearer ${tokenValue ?? token}` };
    const [tRes, hRes, iRes] = await Promise.all([
      fetch(`${apiUrl}/portal/tickets`, { headers: auth }),
      fetch(`${apiUrl}/portal/integrations`, { headers: auth }),
      fetch(`${apiUrl}/portal/incidents`, { headers: auth }),
    ]);
    if (tRes.ok) setTickets(await tRes.json());
    if (hRes.ok) setHealth(await hRes.json());
    if (iRes.ok) setIncidents(await iRes.json());
  }

  async function createTicket() {
    setInfo(null);
    const res = await fetch(`${apiUrl}/portal/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject, message }),
    });
    if (res.ok) {
      setSubject("");
      setMessage("");
      setInfo("Ticket creado.");
      await loadAll();
    }
  }

  async function attachDiagnostic(ticketId: string) {
    setInfo(null);
    const res = await fetch(`${apiUrl}/portal/tickets/diagnostic?id=${ticketId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setInfo("Diagnostico adjuntado.");
      await loadAll();
    }
  }

  async function loadBilling() {
    if (!billingInstanceId || !portalToken) return;
    const res = await fetch(`${controlPlaneUrl}/api/billing/portal?instanceId=${encodeURIComponent(billingInstanceId)}`, {
      headers: { "x-portal-token": portalToken },
    });
    if (res.ok) {
      const data = await res.json();
      setBillingData(data);
      if (!targetPlanId && data.account?.plan?.id) {
        setTargetPlanId(data.account.plan.id);
      }
    }
  }

  async function changePlan() {
    if (!billingInstanceId || !targetPlanId || !portalToken) return;
    const res = await fetch(`${controlPlaneUrl}/api/billing/portal`, {
      method: "POST",
      headers: {
        "x-portal-token": portalToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceId: billingInstanceId,
        targetPlanId,
      }),
    });
    if (!res.ok) {
      setInfo("No se pudo cambiar plan.");
      return;
    }
    const data = await res.json();
    setInfo(`Plan actualizado. Prorrateo: ${data.proration?.prorationAmount ?? 0}`);
    await loadBilling();
  }

  if (!token) {
    return (
      <main>
        <h1>Portal de Soporte</h1>
        <p>Acceso para clientes B2B.</p>

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label style={{ marginTop: 12, display: "block" }}>
          Empresa (ID, opcional)
          <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
        </label>

        <label style={{ marginTop: 12, display: "block" }}>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <button style={{ marginTop: 12 }} onClick={login}>
          Ingresar
        </button>
        {loginError && <p style={{ color: "crimson" }}>{loginError}</p>}
      </main>
    );
  }

  return (
    <main>
      <h1>Portal de Soporte</h1>
      <p>Tickets, incidentes e integraciones.</p>

      <button className="secondary" onClick={() => loadAll()}>
        Actualizar
      </button>
      {info && <p style={{ color: "green" }}>{info}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Cuenta y facturacion</h2>
        <label>
          Instance ID
          <input value={billingInstanceId} onChange={(e) => setBillingInstanceId(e.target.value)} />
        </label>
        <button className="secondary" onClick={loadBilling}>
          Ver estado de cuenta
        </button>
        {billingData && (
          <div style={{ marginTop: 12 }}>
            <strong>Plan:</strong> {billingData.account?.plan?.name} ({billingData.account?.status})
            <div>Proximo cobro: {billingData.account?.nextBillingAt ? new Date(billingData.account.nextBillingAt).toLocaleDateString() : "-"}</div>
            <div>Trial: {billingData.account?.trialEndsAt ? new Date(billingData.account.trialEndsAt).toLocaleDateString() : "-"}</div>
            <div>Uso mes: {billingData.account?.monthlyOrders ?? 0} ordenes / GMV {billingData.account?.monthlyGmvArs ?? 0} ARS</div>
            <div>Estimado: {billingData.account?.pricingPreview?.totalArs ?? 0} ARS</div>
            {(billingData.account?.warnings ?? []).map((warning: string, idx: number) => (
              <div key={idx} style={{ color: "#b05a00" }}>{warning}</div>
            ))}
            <div style={{ marginTop: 8 }}>
              <label>
                Cambiar plan
                <select value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)}>
                  {(billingData.plans ?? []).map((plan: any) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {plan.price} {plan.currency}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary" onClick={changePlan}>
                Upgrade / Downgrade
              </button>
            </div>
            <h3>Facturas</h3>
            {(billingData.invoices ?? []).map((inv: any) => (
              <div key={inv.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
                {inv.status} - {inv.amount} {inv.currency} - venc. {new Date(inv.dueAt).toLocaleDateString()}
              </div>
            ))}
            <h3>Historial de cambios</h3>
            {(billingData.history ?? []).map((change: any) => (
              <div key={change.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
                {new Date(change.effectiveAt).toLocaleString()} - {change.fromPlanId} a {change.toPlanId} (prorrateo {change.prorationAmount})
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Crear ticket</h2>
        <label>
          Asunto
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label style={{ marginTop: 12, display: "block" }}>
          Mensaje
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <button style={{ marginTop: 12 }} onClick={createTicket}>
          Enviar
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Tickets</h2>
        {tickets.length === 0 && <p>No hay tickets.</p>}
        {tickets.map((ticket) => (
          <div key={ticket.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
            <strong>{ticket.subject}</strong> - {ticket.status} {" "}
            <span style={{ color: "#666" }}>{new Date(ticket.createdAt).toLocaleString()}</span>
            <div>
              <button className="secondary" onClick={() => attachDiagnostic(ticket.id)}>
                Adjuntar diagnostico
              </button>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Incidentes</h2>
        {incidents.length === 0 && <p>No hay incidentes activos.</p>}
        {incidents.map((inc) => (
          <div key={inc.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
            <strong>{inc.title}</strong> - {inc.status} ({inc.severity})
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Integraciones</h2>
        {health.length === 0 && <p>No hay datos.</p>}
        {health.map((item) => (
          <div key={item.provider} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
            <strong>{item.provider}</strong> - {item.status} {" "}
            <span style={{ color: "#666" }}>{new Date(item.checkedAt).toLocaleString()}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
