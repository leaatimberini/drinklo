"use client";

import { useState } from "react";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(kind: "email" | "webhook") {
    setBusy(true);
    setMsg("");
    try {
      const body = kind === "email" ? { email } : { webhookUrl };
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "subscribe_failed");
      setMsg("Subscription registered.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid">
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Subscribe to Incident Updates</h1>
        <p className="muted">Email or webhook subscription (optional for customers).</p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Email</h2>
          <input
            className="btn"
            style={{ width: "100%" }}
            type="email"
            value={email}
            placeholder="ops@cliente.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <button className="btn" disabled={busy || !email.trim()} onClick={() => void submit("email")}>
              Subscribe by email
            </button>
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Webhook</h2>
          <input
            className="btn"
            style={{ width: "100%" }}
            type="url"
            value={webhookUrl}
            placeholder="https://cliente.com/status-webhook"
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <button className="btn" disabled={busy || !webhookUrl.trim()} onClick={() => void submit("webhook")}>
              Register webhook
            </button>
          </div>
        </div>
      </section>
      {msg ? <div className="card">{msg}</div> : null}
    </main>
  );
}
