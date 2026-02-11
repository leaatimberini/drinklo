"use client";

import { useEffect, useState } from "react";

export default function EmailTemplatesPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [type, setType] = useState("order_confirmation");
  const [objective, setObjective] = useState("Confirmación de pedido");
  const [selected, setSelected] = useState<any | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState("");

  async function fetchList() {
    const res = await fetch(`${apiUrl}/admin/email-templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data);
    }
  }

  async function generate() {
    const res = await fetch(`${apiUrl}/admin/email-templates/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, objective }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelected(data);
      setSubject(data.subject);
      setBody(data.body);
      fetchList();
    }
  }

  async function save() {
    if (!selected) return;
    const res = await fetch(`${apiUrl}/admin/email-templates/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject, body }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelected(data);
      fetchList();
    }
  }

  async function approve() {
    if (!selected) return;
    const res = await fetch(`${apiUrl}/admin/email-templates/${selected.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSelected(data);
      fetchList();
    }
  }

  async function sendTest() {
    if (!selected) return;
    await fetch(`${apiUrl}/admin/email-templates/${selected.id}/send-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: testEmail }),
    });
  }

  useEffect(() => {
    if (token) fetchList();
  }, [token]);

  return (
    <main style={{ padding: 32, maxWidth: 980 }}>
      <h1 style={{ fontSize: 28, fontFamily: "var(--font-heading)" }}>Email Templates</h1>

      <section style={{ marginTop: 16 }}>
        <label>
          JWT Token
          <input value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Generar</h2>
        <input value={type} onChange={(e) => setType(e.target.value)} placeholder="tipo" />
        <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="objetivo" />
        <button onClick={generate}>Generar</button>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Lista</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {templates.map((t) => (
            <button key={t.id} onClick={() => {
              setSelected(t);
              setSubject(t.subject);
              setBody(t.body);
            }}>
              {t.type} v{t.version} ({t.status})
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section style={{ marginTop: 16 }}>
          <h2>Editar</h2>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save}>Guardar</button>
            <button onClick={approve}>Aprobar</button>
          </div>

          <h3 style={{ marginTop: 16 }}>Preview</h3>
          <div style={{ border: "1px solid var(--card-border)", padding: 12 }} dangerouslySetInnerHTML={{ __html: body }} />

          <div style={{ marginTop: 12 }}>
            <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@email.com" />
            <button onClick={sendTest}>Enviar test</button>
          </div>
        </section>
      )}
    </main>
  );
}
