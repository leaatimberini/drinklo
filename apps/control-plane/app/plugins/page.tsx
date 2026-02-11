"use client";

import { useEffect, useState } from "react";

type Release = {
  id: string;
  name: string;
  version: string;
  channel: string;
  compatibility?: string | null;
  changelog?: string | null;
  createdAt: string;
};

type Request = {
  id: string;
  instanceId: string;
  pluginName: string;
  version?: string | null;
  action: string;
  status: string;
  requestedAt: string;
};

type Job = {
  id: string;
  pluginName: string;
  version?: string | null;
  action: string;
  status: string;
  durationMs?: number | null;
  createdAt: string;
};

export default function PluginsMarketplacePage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({
    name: "",
    version: "",
    channel: "stable",
    compatibility: "",
    changelog: "",
    signature: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [rRes, reqRes] = await Promise.all([
      fetch("/api/plugins/releases"),
      fetch("/api/plugins/requests/list?status=pending"),
    ]);
    if (rRes.ok) setReleases(await rRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
    const jobsRes = await fetch("/api/plugins/jobs?limit=200");
    if (jobsRes.ok) setJobs(await jobsRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function publish() {
    setMessage(null);
    const res = await fetch("/api/plugins/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        version: form.version,
        channel: form.channel,
        compatibility: form.compatibility || null,
        changelog: form.changelog || null,
        signature: form.signature,
      }),
    });
    if (res.ok) {
      setMessage("Release published.");
      setForm({
        name: "",
        version: "",
        channel: "stable",
        compatibility: "",
        changelog: "",
        signature: "",
      });
      await load();
    } else {
      const payload = await res.json().catch(() => ({}));
      setMessage(payload.error ?? "Publish failed");
    }
  }

  async function approveRequest(id: string) {
    await fetch(`/api/plugins/requests/${id}/approve`, { method: "POST" });
    await load();
  }

  return (
    <main>
      <h1>Plugin Marketplace</h1>
      <p>Publish extensions/packs and approve install requests.</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Publish Release</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Version
          <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
        </label>
        <label>
          Channel
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>
        </label>
        <label>
          Compatibility
          <input value={form.compatibility} onChange={(e) => setForm({ ...form, compatibility: e.target.value })} />
        </label>
        <label>
          Changelog
          <textarea rows={3} value={form.changelog} onChange={(e) => setForm({ ...form, changelog: e.target.value })} />
        </label>
        <label>
          Signature
          <input value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} />
        </label>
        <button style={{ marginTop: 8 }} onClick={publish}>
          Publish
        </button>
        {message && <p>{message}</p>}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Pending Requests</h2>
        {requests.length === 0 && <p>No pending requests.</p>}
        {requests.map((req) => (
          <div key={req.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{req.pluginName}</strong> {req.version ?? "-"} ({req.action}) — {req.instanceId}
            <button style={{ marginLeft: 12 }} onClick={() => approveRequest(req.id)}>
              Approve
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Releases</h2>
        {releases.map((rel) => (
          <div key={rel.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{rel.name}</strong> {rel.version} ({rel.channel})
            {rel.compatibility && <span> — {rel.compatibility}</span>}
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Plugin Telemetry</h2>
        {jobs.length === 0 && <p>No jobs yet.</p>}
        {jobs.slice(0, 20).map((job) => (
          <div key={job.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{job.pluginName}</strong> {job.version ?? "-"} ({job.action}) — {job.status}
            {job.durationMs != null && <span> — {job.durationMs}ms</span>}
          </div>
        ))}
      </section>
    </main>
  );
}
