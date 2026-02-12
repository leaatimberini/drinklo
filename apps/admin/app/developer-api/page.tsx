"use client";

import { useEffect, useMemo, useState } from "react";

type KeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMin: number;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
};

type WebhookItem = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  deletedAt?: string | null;
};

const EVENT_OPTIONS = ["OrderCreated", "PaymentApproved", "StockLow"];

export default function DeveloperApiPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [usage, setUsage] = useState<any | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [newKeyName, setNewKeyName] = useState("Integracion externa");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read:products"]);
  const [newKeyRate, setNewKeyRate] = useState(120);

  const [newWebhookName, setNewWebhookName] = useState("Webhook principal");
  const [newWebhookUrl, setNewWebhookUrl] = useState("https://example.com/webhooks/erp");
  const [newWebhookSecret, setNewWebhookSecret] = useState("change-me");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["OrderCreated"]);

  const topRoutes = useMemo(() => usage?.byRoute?.slice(0, 10) ?? [], [usage]);

  async function fetchJson(path: string, init?: RequestInit) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "Request failed");
    }
    return response.json();
  }

  async function loadAll() {
    setError(null);
    try {
      const [scopeData, keyData, usageData, webhookData] = await Promise.all([
        fetchJson("/admin/developer-api/scopes"),
        fetchJson("/admin/developer-api/keys"),
        fetchJson("/admin/developer-api/usage"),
        fetchJson("/admin/developer-api/webhooks"),
      ]);
      setAvailableScopes(scopeData.scopes ?? []);
      setKeys(keyData ?? []);
      setUsage(usageData ?? null);
      setWebhooks(webhookData ?? []);
    } catch (err: any) {
      setError(err.message ?? "No se pudo cargar");
    }
  }

  useEffect(() => {
    if (token) {
      void loadAll();
    }
  }, [token]);

  async function createKey() {
    setError(null);
    setMessage(null);
    setCreatedKey(null);
    try {
      const result = await fetchJson("/admin/developer-api/keys", {
        method: "POST",
        body: JSON.stringify({
          name: newKeyName,
          scopes: newKeyScopes,
          rateLimitPerMin: Number(newKeyRate),
        }),
      });
      setCreatedKey(result.key);
      setMessage("API key creada.");
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear la key");
    }
  }

  async function updateKey(item: KeyItem) {
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/admin/developer-api/keys/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          scopes: item.scopes,
          rateLimitPerMin: Number(item.rateLimitPerMin),
        }),
      });
      setMessage("Key actualizada.");
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? "No se pudo actualizar");
    }
  }

  async function revokeKey(id: string) {
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/admin/developer-api/keys/${id}/revoke`, { method: "POST" });
      setMessage("Key revocada.");
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? "No se pudo revocar");
    }
  }

  async function createWebhook() {
    setError(null);
    setMessage(null);
    try {
      await fetchJson("/admin/developer-api/webhooks", {
        method: "POST",
        body: JSON.stringify({
          name: newWebhookName,
          url: newWebhookUrl,
          secret: newWebhookSecret,
          events: newWebhookEvents,
        }),
      });
      setMessage("Webhook creado.");
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear webhook");
    }
  }

  async function revokeWebhook(id: string) {
    setError(null);
    setMessage(null);
    try {
      await fetchJson(`/admin/developer-api/webhooks/${id}/revoke`, { method: "POST" });
      setMessage("Webhook revocado.");
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? "No se pudo revocar webhook");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1200 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 30 }}>Developer API</h1>
      <p style={{ color: "#555" }}>Keys por empresa, scopes, rate limits y webhooks salientes.</p>

      <section style={{ marginTop: 16 }}>
        <label>
          Token JWT
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </label>
        <button style={{ marginLeft: 8 }} onClick={loadAll}>Recargar</button>
      </section>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      {message && <p style={{ color: "green", marginTop: 12 }}>{message}</p>}
      {createdKey && (
        <pre style={{ marginTop: 12, background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
          Guardar ahora (no se mostrara nuevamente): {createdKey}
        </pre>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Crear API Key</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Nombre" />
          <input type="number" min={1} value={newKeyRate} onChange={(e) => setNewKeyRate(Number(e.target.value))} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableScopes.map((scope) => (
            <label key={scope} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: "4px 8px" }}>
              <input
                type="checkbox"
                checked={newKeyScopes.includes(scope)}
                onChange={(e) =>
                  setNewKeyScopes((prev) =>
                    e.target.checked ? Array.from(new Set([...prev, scope])) : prev.filter((candidate) => candidate !== scope),
                  )
                }
              />
              {scope}
            </label>
          ))}
        </div>
        <button style={{ marginTop: 8 }} onClick={createKey}>Generar key</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Keys</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {keys.map((item) => (
            <div key={item.id} style={{ border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{item.name}</strong>
                <span>{item.revokedAt ? "REVOCADA" : "ACTIVA"}</span>
              </div>
              <small>{item.keyPrefix}</small>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {availableScopes.map((scope) => (
                  <label key={`${item.id}-${scope}`} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: "2px 6px" }}>
                    <input
                      type="checkbox"
                      checked={item.scopes.includes(scope)}
                      disabled={Boolean(item.revokedAt)}
                      onChange={(e) =>
                        setKeys((prev) =>
                          prev.map((candidate) => {
                            if (candidate.id !== item.id) {
                              return candidate;
                            }
                            const scopes = e.target.checked
                              ? Array.from(new Set([...candidate.scopes, scope]))
                              : candidate.scopes.filter((x) => x !== scope);
                            return { ...candidate, scopes };
                          }),
                        )
                      }
                    />
                    {scope}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <label>
                  RPM
                  <input
                    type="number"
                    min={1}
                    value={item.rateLimitPerMin}
                    disabled={Boolean(item.revokedAt)}
                    onChange={(e) =>
                      setKeys((prev) =>
                        prev.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, rateLimitPerMin: Number(e.target.value) }
                            : candidate,
                        ),
                      )
                    }
                  />
                </label>
                <button disabled={Boolean(item.revokedAt)} onClick={() => updateKey(item)}>Guardar</button>
                <button disabled={Boolean(item.revokedAt)} onClick={() => revokeKey(item.id)}>Revocar</button>
              </div>
              <small>
                Creada: {new Date(item.createdAt).toLocaleString()} | Ultimo uso: {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : "-"}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Uso</h2>
        <p>Requests recientes: {usage?.recent?.length ?? 0} | Rate limit hits: {usage?.rateLimitHits ?? 0}</p>
        <div style={{ display: "grid", gap: 8 }}>
          {topRoutes.map((row: any, idx: number) => (
            <div key={`${row.route}-${idx}`} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 8 }}>
              {row.method} {row.route} - {row.requests}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Webhooks salientes</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={newWebhookName} onChange={(e) => setNewWebhookName(e.target.value)} placeholder="Nombre" />
          <input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://..." />
          <input value={newWebhookSecret} onChange={(e) => setNewWebhookSecret(e.target.value)} placeholder="Secret" />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EVENT_OPTIONS.map((event) => (
            <label key={event} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: "4px 8px" }}>
              <input
                type="checkbox"
                checked={newWebhookEvents.includes(event)}
                onChange={(e) =>
                  setNewWebhookEvents((prev) =>
                    e.target.checked ? Array.from(new Set([...prev, event])) : prev.filter((candidate) => candidate !== event),
                  )
                }
              />
              {event}
            </label>
          ))}
        </div>
        <button style={{ marginTop: 8 }} onClick={createWebhook}>Crear webhook</button>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {webhooks.map((hook) => (
            <div key={hook.id} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{hook.name}</strong>
                <span>{hook.active ? "OK" : "INACTIVE"}</span>
              </div>
              <div>{hook.url}</div>
              <small>{hook.events.join(", ")}</small>
              {hook.active && <div><button style={{ marginTop: 6 }} onClick={() => revokeWebhook(hook.id)}>Revocar</button></div>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
