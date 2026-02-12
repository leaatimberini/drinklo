"use client";

import { useState } from "react";

export default function IamPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<any>({
    ssoEnabled: false,
    ssoProtocol: "NONE",
    mfaEnabled: true,
    mfaRequiredRoles: ["admin", "support"],
    scimEnabled: false,
    scimBearerToken: "",
    oidcIssuer: "",
    oidcClientId: "",
    oidcAuthUrl: "",
    oidcTokenUrl: "",
    samlEntityId: "",
    samlSsoUrl: "",
    samlCertificate: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState<any>(null);

  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function load() {
    setMsg(null);
    const res = await fetch(`${apiUrl}/admin/iam/config`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return setMsg("No autorizado o IAM no disponible");
    setConfig(await res.json());
  }

  async function save() {
    setMsg(null);
    const res = await fetch(`${apiUrl}/admin/iam/config`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify(config),
    });
    if (!res.ok) return setMsg("Error guardando configuración");
    setConfig(await res.json());
    setMsg("Configuración guardada");
  }

  async function testConnection(protocol: "OIDC" | "SAML") {
    const res = await fetch(`${apiUrl}/admin/iam/test-connection`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ protocol }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(data.ok ? `Conexión ${protocol} OK` : `Test ${protocol} failed: ${data.error ?? "unknown"}`);
  }

  async function setupMfa() {
    const res = await fetch(`${apiUrl}/admin/iam/mfa/setup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setMsg("No se pudo iniciar MFA");
    const data = await res.json();
    setMfaSetup(data);
    setMsg("Escaneá el QR/otpauth y verificá código");
  }

  async function verifyMfa() {
    const res = await fetch(`${apiUrl}/admin/iam/mfa/verify`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ code: mfaCode }),
    });
    if (!res.ok) return setMsg("Código MFA inválido");
    setMsg("MFA activado");
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 14 }}>
      <h1>IAM Enterprise</h1>
      <label>
        JWT admin/soporte
        <input value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load}>Cargar</button>
        <button onClick={save}>Guardar</button>
      </div>

      <section className="card">
        <h2>SSO</h2>
        <label><input type="checkbox" checked={config.ssoEnabled} onChange={(e) => setConfig({ ...config, ssoEnabled: e.target.checked })} /> Habilitado</label>
        <label>
          Protocolo
          <select value={config.ssoProtocol} onChange={(e) => setConfig({ ...config, ssoProtocol: e.target.value })}>
            <option value="NONE">NONE</option>
            <option value="OIDC">OIDC</option>
            <option value="SAML">SAML</option>
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input placeholder="OIDC issuer" value={config.oidcIssuer ?? ""} onChange={(e) => setConfig({ ...config, oidcIssuer: e.target.value })} />
          <input placeholder="OIDC clientId" value={config.oidcClientId ?? ""} onChange={(e) => setConfig({ ...config, oidcClientId: e.target.value })} />
          <input placeholder="OIDC auth URL" value={config.oidcAuthUrl ?? ""} onChange={(e) => setConfig({ ...config, oidcAuthUrl: e.target.value })} />
          <input placeholder="OIDC token URL" value={config.oidcTokenUrl ?? ""} onChange={(e) => setConfig({ ...config, oidcTokenUrl: e.target.value })} />
          <input placeholder="SAML entityId" value={config.samlEntityId ?? ""} onChange={(e) => setConfig({ ...config, samlEntityId: e.target.value })} />
          <input placeholder="SAML SSO URL" value={config.samlSsoUrl ?? ""} onChange={(e) => setConfig({ ...config, samlSsoUrl: e.target.value })} />
        </div>
        <textarea placeholder="SAML certificate" value={config.samlCertificate ?? ""} onChange={(e) => setConfig({ ...config, samlCertificate: e.target.value })} rows={4} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => testConnection("OIDC")}>Test OIDC</button>
          <button onClick={() => testConnection("SAML")}>Test SAML</button>
        </div>
      </section>

      <section className="card">
        <h2>MFA</h2>
        <label><input type="checkbox" checked={config.mfaEnabled} onChange={(e) => setConfig({ ...config, mfaEnabled: e.target.checked })} /> Enforce MFA</label>
        <input
          placeholder="roles,comma"
          value={(config.mfaRequiredRoles ?? []).join(",")}
          onChange={(e) => setConfig({ ...config, mfaRequiredRoles: e.target.value.split(",").map((v: string) => v.trim()).filter(Boolean) })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={setupMfa}>Setup MFA</button>
          <input placeholder="123456" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
          <button onClick={verifyMfa}>Verify MFA</button>
        </div>
        {mfaSetup && <code style={{ fontSize: 12 }}>{mfaSetup.otpauthUrl}</code>}
      </section>

      <section className="card">
        <h2>SCIM</h2>
        <label><input type="checkbox" checked={config.scimEnabled} onChange={(e) => setConfig({ ...config, scimEnabled: e.target.checked })} /> Habilitado</label>
        <input placeholder="SCIM bearer token" value={config.scimBearerToken ?? ""} onChange={(e) => setConfig({ ...config, scimBearerToken: e.target.value })} />
        <p style={{ margin: 0 }}>Endpoint: <code>{apiUrl}/scim/v2/Users</code></p>
      </section>

      {msg && <p>{msg}</p>}
    </main>
  );
}
