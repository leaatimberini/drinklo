"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const connectorTemplate = {
  name: "Webhook pedidos",
  sourceEvent: "OrderCreated",
  enabled: true,
  destinationType: "WEBHOOK",
  method: "POST",
  destinationUrl: "https://example.com/webhooks/orders",
  headers: {
    "x-source": "erp",
  },
  mapping: {
    eventId: "$.id",
    eventName: "$.name",
    orderId: "$.payload.orderId",
    shippingMode: "$.payload.shippingMode",
    occurredAt: "$.occurredAt",
  },
  retryMaxAttempts: 3,
  retryBackoffBaseMs: 1000,
  timeoutMs: 10000,
  authMode: "NONE",
};

const sampleEventTemplate = {
  id: "evt-preview-1",
  name: "OrderCreated",
  schemaVersion: 1,
  occurredAt: new Date().toISOString(),
  source: "api",
  companyId: "preview-co",
  subjectId: "order-1",
  payload: {
    orderId: "order-1",
    shippingMode: "DELIVERY",
    total: 2500,
  },
};

export default function IntegrationBuilderPage() {
  const [token, setToken] = useState("");
  const [connectors, setConnectors] = useState<any[]>([]);
  const [editorJson, setEditorJson] = useState(JSON.stringify([connectorTemplate], null, 2));
  const [sampleEventJson, setSampleEventJson] = useState(JSON.stringify(sampleEventTemplate, null, 2));
  const [previewResult, setPreviewResult] = useState("");
  const [secretConnectorId, setSecretConnectorId] = useState("");
  const [secretJson, setSecretJson] = useState(JSON.stringify({ token: "test_token" }, null, 2));
  const [logsConnectorId, setLogsConnectorId] = useState("");
  const [logsResult, setLogsResult] = useState("");
  const [metricsResult, setMetricsResult] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  async function call(path: string, init?: RequestInit) {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    if (!res.ok) throw new Error(typeof json === "string" ? json : JSON.stringify(json));
    return json;
  }

  async function load() {
    setMessage(null);
    try {
      const rows = await call("/admin/integration-builder/connectors");
      setConnectors(rows);
      if (rows[0]?.id) {
        setSecretConnectorId(rows[0].id);
        setLogsConnectorId(rows[0].id);
      }
      setEditorJson(
        JSON.stringify(
          rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            sourceEvent: r.sourceEvent,
            enabled: r.enabled,
            destinationType: r.destinationType,
            method: r.method,
            destinationUrl: r.destinationUrl,
            headers: r.headers ?? {},
            mapping: r.mapping ?? {},
            timeoutMs: r.timeoutMs,
            retryMaxAttempts: r.retryMaxAttempts,
            retryBackoffBaseMs: r.retryBackoffBaseMs,
            authMode: r.authMode,
            authHeaderName: r.authHeaderName ?? undefined,
          })),
          null,
          2,
        ),
      );
      setMessage("Conectores cargados");
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  }

  async function save() {
    setMessage(null);
    try {
      const items = JSON.parse(editorJson);
      const rows = await call("/admin/integration-builder/connectors", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      setConnectors(rows);
      setMessage("Conectores guardados");
    } catch (error: any) {
      setMessage(`Error guardando: ${error.message}`);
    }
  }

  async function preview() {
    setMessage(null);
    try {
      const items = JSON.parse(editorJson);
      const sampleEvent = JSON.parse(sampleEventJson);
      const result = await call("/admin/integration-builder/preview", {
        method: "POST",
        body: JSON.stringify({ connector: items[0], sampleEvent }),
      });
      setPreviewResult(JSON.stringify(result, null, 2));
      setMessage("Preview OK");
    } catch (error: any) {
      setMessage(`Error preview: ${error.message}`);
    }
  }

  async function rotateSecret() {
    setMessage(null);
    try {
      if (!secretConnectorId) throw new Error("Seleccionar connector");
      const payload = JSON.parse(secretJson);
      const result = await call(`/admin/integration-builder/connectors/${secretConnectorId}/secret`, {
        method: "POST",
        body: JSON.stringify({ payload, verified: true }),
      });
      setMessage(`Secret guardado: ${JSON.stringify(result)}`);
    } catch (error: any) {
      setMessage(`Error secret: ${error.message}`);
    }
  }

  async function loadLogsAndMetrics() {
    setMessage(null);
    try {
      if (!logsConnectorId) throw new Error("Seleccionar connector");
      const [logs, metrics] = await Promise.all([
        call(`/admin/integration-builder/connectors/${logsConnectorId}/logs?limit=20`),
        call(`/admin/integration-builder/connectors/${logsConnectorId}/metrics`),
      ]);
      setLogsResult(JSON.stringify(logs, null, 2));
      setMetricsResult(JSON.stringify(metrics, null, 2));
    } catch (error: any) {
      setMessage(`Error logs/métricas: ${error.message}`);
    }
  }

  async function retryDlq() {
    setMessage(null);
    try {
      if (!logsConnectorId) throw new Error("Seleccionar connector");
      const result = await call(`/admin/integration-builder/connectors/${logsConnectorId}/retry-dlq`, {
        method: "POST",
      });
      setMessage(`DLQ requeue: ${JSON.stringify(result)}`);
    } catch (error: any) {
      setMessage(`Error DLQ: ${error.message}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Integration Builder</h1>
      <p style={{ margin: 0 }}>
        Crear conectores simples: <code>source event</code> -&gt; <code>mapping JSON</code> -&gt; webhook/API.
      </p>
      <label>
        Token JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={load}>Cargar</button>
        <button onClick={save}>Guardar connectors</button>
        <button onClick={preview}>Preview payload</button>
      </div>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Connectors (JSON)</h2>
        <textarea rows={16} value={editorJson} onChange={(e) => setEditorJson(e.target.value)} style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace" }} />
        <p style={{ marginBottom: 0 }}>
          Conectores cargados: {connectors.length}
          {connectors.length > 0 ? ` (${connectors.map((c) => c.name).join(", ")})` : ""}
        </p>
      </section>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Preview (payload test)</h2>
        <textarea rows={10} value={sampleEventJson} onChange={(e) => setSampleEventJson(e.target.value)} style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace" }} />
        <pre style={{ whiteSpace: "pre-wrap" }}>{previewResult || "Sin preview"}</pre>
      </section>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Secrets por connector</h2>
        <label>
          Connector ID
          <input value={secretConnectorId} onChange={(e) => setSecretConnectorId(e.target.value)} />
        </label>
        <textarea rows={6} value={secretJson} onChange={(e) => setSecretJson(e.target.value)} style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace" }} />
        <button onClick={rotateSecret}>Guardar secret</button>
      </section>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Logs y métricas por connector</h2>
        <label>
          Connector ID
          <input value={logsConnectorId} onChange={(e) => setLogsConnectorId(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={loadLogsAndMetrics}>Cargar logs/métricas</button>
          <button onClick={retryDlq}>Reintentar DLQ</button>
        </div>
        <h3>Métricas (24h)</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{metricsResult || "Sin métricas"}</pre>
        <h3>Logs</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{logsResult || "Sin logs"}</pre>
      </section>

      {message && <p>{message}</p>}
    </main>
  );
}

