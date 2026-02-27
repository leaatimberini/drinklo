"use client";

import { useState } from "react";
import { useAuth } from "../../auth-provider";

export default function DevToolsPage() {
  const { applyManualToken, refreshMe, user } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function applyToken() {
    setMessage(null);
    try {
      await applyManualToken(tokenInput.trim());
      await refreshMe();
      setMessage("Token applied");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to apply token");
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 840 }}>
      <h1>Admin Dev Tools</h1>
      <p>Use only in local/dev for manual JWT testing.</p>
      <label style={{ display: "block", marginTop: 16 }}>
        Manual JWT token
        <textarea
          rows={4}
          style={{ marginTop: 8 }}
          value={tokenInput}
          onChange={(event) => setTokenInput(event.target.value)}
          placeholder="Paste Bearer token payload here"
        />
      </label>
      <button type="button" onClick={applyToken} style={{ marginTop: 12 }}>
        Apply token
      </button>
      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      <pre style={{ marginTop: 20, background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
        {JSON.stringify(user, null, 2)}
      </pre>
    </main>
  );
}
