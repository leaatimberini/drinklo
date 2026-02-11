"use client";

import { useState } from "react";

type PolicyForm = {
  retentionLogsDays: number;
  retentionOrdersDays: number;
  retentionMarketingDays: number;
};

export default function PrivacyPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicyForm>({
    retentionLogsDays: 90,
    retentionOrdersDays: 365,
    retentionMarketingDays: 365,
  });

  async function loadPolicies() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/privacy/policies`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("No se pudo cargar políticas");
      return;
    }
    const data = await res.json();
    setPolicy({
      retentionLogsDays: data.retentionLogsDays ?? 90,
      retentionOrdersDays: data.retentionOrdersDays ?? 365,
      retentionMarketingDays: data.retentionMarketingDays ?? 365,
    });
  }

  async function savePolicies() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/privacy/policies`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(policy),
    });
    setMessage(res.ok ? "Políticas guardadas" : "Error al guardar políticas");
  }

  async function exportCustomer(format: "json" | "csv") {
    setMessage(null);
    if (!customerId) {
      setMessage("Ingresar customerId");
      return;
    }
    const url = `${apiUrl}/admin/privacy/customers/${customerId}/export?format=${format}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMessage("Error al exportar");
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `customer-${customerId}.${format}`;
    link.click();
  }

  async function anonymizeCustomer() {
    setMessage(null);
    if (!customerId) {
      setMessage("Ingresar customerId");
      return;
    }
    const res = await fetch(`${apiUrl}/admin/privacy/customers/${customerId}/anonymize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notes: "admin" }),
    });
    setMessage(res.ok ? "Cliente anonimizado" : "Error al anonimizar");
  }

  return (
    <main style={{ padding: 32, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Privacidad y datos</h1>
      <p>Exportación y anonimización de datos personales.</p>

      <label style={{ display: "block", marginTop: 12 }}>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <section style={{ marginTop: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>Exportar cliente</h2>
        <label style={{ display: "block", marginBottom: 12 }}>
          Customer ID
          <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
        </label>
        <button onClick={() => exportCustomer("json")}>Export JSON</button>
        <button onClick={() => exportCustomer("csv")} style={{ marginLeft: 8 }}>Export CSV</button>
      </section>

      <section style={{ marginTop: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>Anonimizar cliente</h2>
        <button onClick={anonymizeCustomer}>Anonimizar (soft-delete)</button>
      </section>

      <section style={{ marginTop: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>Políticas de retención</h2>
        <button onClick={loadPolicies}>Cargar</button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <label>
            Logs (días)
            <input
              type="number"
              value={policy.retentionLogsDays}
              onChange={(e) => setPolicy({ ...policy, retentionLogsDays: Number(e.target.value) })}
            />
          </label>
          <label>
            Pedidos (días)
            <input
              type="number"
              value={policy.retentionOrdersDays}
              onChange={(e) => setPolicy({ ...policy, retentionOrdersDays: Number(e.target.value) })}
            />
          </label>
          <label>
            Marketing (días)
            <input
              type="number"
              value={policy.retentionMarketingDays}
              onChange={(e) => setPolicy({ ...policy, retentionMarketingDays: Number(e.target.value) })}
            />
          </label>
        </div>
        <button style={{ marginTop: 12 }} onClick={savePolicies}>Guardar políticas</button>
      </section>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </main>
  );
}
