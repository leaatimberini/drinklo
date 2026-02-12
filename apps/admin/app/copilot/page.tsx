"use client";

import { useEffect, useState } from "react";

type Proposal = {
  id: string;
  actionType: string;
  status: string;
  requiredPermission: string;
  preview: any;
  executionResult?: any;
  createdAt: string;
};

export default function CopilotPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function refreshProposals() {
    if (!token) return;
    const res = await fetch(`${apiUrl}/admin/copilot/proposals?status=PENDING`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setProposals(data ?? []);
  }

  useEffect(() => {
    refreshProposals().catch(() => undefined);
  }, [token]);

  async function askCopilot() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/copilot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, mode: "admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message ?? "Error consultando copiloto");
      }
      setAnswer(String(data.message ?? ""));
      await refreshProposals();
    } catch (err: any) {
      setError(err.message ?? "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  }

  async function approveProposal(id: string) {
    setError("");
    const res = await fetch(`${apiUrl}/admin/copilot/proposals/${id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ note: "approved_from_admin_ui" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message ?? "No se pudo aprobar");
      return;
    }
    await refreshProposals();
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ marginTop: 0 }}>Copiloto IA</h1>
      <p>Consultas NLQ y propuestas con preview + aprobar.</p>

      <label style={{ display: "block", marginBottom: 12 }}>
        JWT
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          style={{ display: "block", width: "100%", marginTop: 6 }}
        />
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        Prompt
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej: mostrar ventas y crear cupon del 10%"
          style={{ display: "block", width: "100%", marginTop: 6, minHeight: 100 }}
        />
      </label>

      <button type="button" onClick={askCopilot} disabled={!token || !prompt.trim() || isLoading}>
        {isLoading ? "Consultando..." : "Consultar Copiloto"}
      </button>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {answer && (
        <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <strong>Respuesta</strong>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{answer}</pre>
        </section>
      )}

      <section style={{ marginTop: 20 }}>
        <h2>Propuestas pendientes</h2>
        {proposals.length === 0 && <p>Sin propuestas pendientes.</p>}
        {proposals.map((proposal) => (
          <article key={proposal.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <p style={{ margin: "0 0 6px" }}>
              <strong>{proposal.actionType}</strong> - {proposal.requiredPermission}
            </p>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(proposal.preview, null, 2)}
            </pre>
            <button type="button" style={{ marginTop: 8 }} onClick={() => approveProposal(proposal.id)}>
              Aprobar y ejecutar
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
