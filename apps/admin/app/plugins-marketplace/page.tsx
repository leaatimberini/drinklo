"use client";

import { useState } from "react";

type PluginInfo = {
  name: string;
  version: string;
  permissions: string[];
  hooks: string[];
  uiSlots: string[];
  enabled: boolean;
  allowedPermissions: string[];
};

export default function PluginsMarketplacePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [request, setRequest] = useState({ name: "", version: "", action: "install" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPlugins() {
    setError(null);
    const res = await fetch(`${apiUrl}/admin/plugins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? "No autorizado");
      return;
    }
    setPlugins(await res.json());
  }

  async function sendRequest() {
    setError(null);
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/plugins/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pluginName: request.name,
        version: request.version || undefined,
        action: request.action,
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? "Solicitud fallida");
      return;
    }
    setMessage("Solicitud enviada para aprobación.");
  }

  return (
    <main style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>
        Marketplace de Plugins
      </h1>
      <p>Solicitá instalar/actualizar/desinstalar plugins (requiere aprobación del proveedor).</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} />
      </label>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={loadPlugins}>Cargar plugins</button>
      </div>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Solicitud</h2>
        <label>
          Plugin
          <input value={request.name} onChange={(e) => setRequest({ ...request, name: e.target.value })} />
        </label>
        <label style={{ marginTop: 12, display: "block" }}>
          Versión (opcional)
          <input
            value={request.version}
            onChange={(e) => setRequest({ ...request, version: e.target.value })}
          />
        </label>
        <label style={{ marginTop: 12, display: "block" }}>
          Acción
          <select value={request.action} onChange={(e) => setRequest({ ...request, action: e.target.value })}>
            <option value="install">install</option>
            <option value="update">update</option>
            <option value="remove">remove</option>
          </select>
        </label>
        <button style={{ marginTop: 12 }} onClick={sendRequest}>
          Enviar solicitud
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Plugins disponibles</h2>
        {plugins.length === 0 && <p>No hay plugins cargados.</p>}
        {plugins.map((plugin) => (
          <div key={plugin.name} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{plugin.name}</strong> {plugin.version} — {plugin.enabled ? "Enabled" : "Disabled"}
            <div style={{ color: "#666", fontSize: 12 }}>
              Permisos: {plugin.permissions.join(", ") || "-"}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
