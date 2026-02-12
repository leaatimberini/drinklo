"use client";

import { useState } from "react";

export default function SandboxControlPage() {
  const [instanceId, setInstanceId] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runReset() {
    setError(null);
    setOutput(null);
    const res = await fetch("/api/sandbox/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId, apiBaseUrl, adminToken }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "sandbox reset failed");
      setOutput(payload);
      return;
    }
    setOutput(payload);
  }

  return (
    <main>
      <h1>Sandbox Reset Tool</h1>
      <p>Provider tool to reset a tenant sandbox via instance API endpoint.</p>
      <div className="card" style={{ maxWidth: 900 }}>
        <label>
          Instance ID
          <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
        </label>
        <label>
          API Base URL (optional if installation has domain)
          <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://api.example.com" />
        </label>
        <label>
          Admin JWT Token
          <input value={adminToken} onChange={(e) => setAdminToken(e.target.value)} placeholder="Bearer token value" />
        </label>
        <button onClick={runReset}>sandbox-reset</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {output && (
        <pre className="card" style={{ marginTop: 16, overflowX: "auto" }}>{JSON.stringify(output, null, 2)}</pre>
      )}
    </main>
  );
}
