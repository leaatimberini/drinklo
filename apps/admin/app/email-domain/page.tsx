"use client";

import { useEffect, useState } from "react";

type DomainSettings = {
  providerType: "SMTP" | "API";
  providerName?: string | null;
  domain?: string | null;
  spfValue?: string | null;
  dkimSelector?: string | null;
  dkimValue?: string | null;
  dmarcValue?: string | null;
  status?: string | null;
  verifiedAt?: string | null;
};

export default function EmailDomainPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [form, setForm] = useState<DomainSettings>({ providerType: "SMTP" });
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${apiUrl}/admin/email-domain`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as DomainSettings;
    setSettings(data);
    if (data) {
      setForm({
        providerType: data.providerType ?? "SMTP",
        providerName: data.providerName ?? "",
        domain: data.domain ?? "",
        spfValue: data.spfValue ?? "",
        dkimSelector: data.dkimSelector ?? "",
        dkimValue: data.dkimValue ?? "",
        dmarcValue: data.dmarcValue ?? "",
      });
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function save() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/email-domain`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setMessage("Error al guardar");
      return;
    }
    setMessage("Guardado");
    await load();
  }

  async function confirm() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/email-domain/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmed: true }),
    });
    if (!res.ok) {
      setMessage("Error al confirmar");
      return;
    }
    setMessage("Verificado");
    await load();
  }

  const providerType = form.providerType ?? "SMTP";

  return (
    <main style={{ padding: 32, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Dominio & Email</h1>
      <p>Configura SPF/DKIM/DMARC y registra eventos de entregabilidad.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <section style={{ marginTop: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>Proveedor</h2>
        <label style={{ display: "block", marginBottom: 12 }}>
          Tipo
          <select value={providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value as any })}>
            <option value="SMTP">SMTP</option>
            <option value="API">API</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          Nombre proveedor
          <input value={form.providerName ?? ""} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          Dominio
          <input value={form.domain ?? ""} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </label>
      </section>

      <section style={{ marginTop: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", background: "var(--card-bg)" }}>
        <h2 style={{ marginTop: 0 }}>DNS</h2>
        {providerType === "SMTP" ? (
          <p style={{ color: "var(--color-muted)" }}>
            Para SMTP, configura SPF con el host de tu proveedor y DKIM/DMARC según las instrucciones del servicio.
          </p>
        ) : (
          <p style={{ color: "var(--color-muted)" }}>
            Para API, usa los valores SPF/DKIM/DMARC provistos por tu proveedor (SendGrid, Mailgun, etc.).
          </p>
        )}
        <label style={{ display: "block", marginBottom: 12 }}>
          SPF value
          <input value={form.spfValue ?? ""} onChange={(e) => setForm({ ...form, spfValue: e.target.value })} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          DKIM selector
          <input value={form.dkimSelector ?? ""} onChange={(e) => setForm({ ...form, dkimSelector: e.target.value })} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          DKIM value
          <input value={form.dkimValue ?? ""} onChange={(e) => setForm({ ...form, dkimValue: e.target.value })} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          DMARC value
          <input value={form.dmarcValue ?? ""} onChange={(e) => setForm({ ...form, dmarcValue: e.target.value })} />
        </label>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>Checklist</h3>
        <ol>
          <li>Agregar registro SPF en DNS.</li>
          <li>Agregar registro DKIM en DNS.</li>
          <li>Agregar registro DMARC en DNS.</li>
          <li>Enviar email de prueba y revisar rebotes.</li>
        </ol>
        <button onClick={save}>Guardar</button>
        <button onClick={confirm} style={{ marginLeft: 8 }}>Confirmar verificación</button>
        {message && <p style={{ marginTop: 8 }}>{message}</p>}
      </section>

      {settings && (
        <section style={{ marginTop: 20 }}>
          <p><strong>Estado:</strong> {settings.status ?? "PENDING"}</p>
          {settings.verifiedAt && <p><strong>Verificado:</strong> {new Date(settings.verifiedAt).toLocaleString()}</p>}
        </section>
      )}
    </main>
  );
}
