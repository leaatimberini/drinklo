"use client";

import { useEffect, useMemo, useState } from "react";

type Publisher = {
  id: string;
  name: string;
  email: string;
  website?: string | null;
  verificationStatus: string;
  verificationNotes?: string | null;
  defaultRevenueShareBps?: number | null;
  createdAt: string;
  _count?: { submissions: number; releases: number };
};

type Submission = {
  id: string;
  publisherId: string;
  pluginName: string;
  version: string;
  channel: string;
  compatibility?: string | null;
  bundleUrl: string;
  requestedPermissions: string[];
  dependencies: string[];
  revenueShareBps?: number | null;
  status: string;
  reviewReport?: any;
  createdAt: string;
  publisher?: { id: string; name: string; verificationStatus: string };
};

type Release = {
  id: string;
  name: string;
  version: string;
  channel: string;
  compatibility?: string | null;
  changelog?: string | null;
  reviewStatus?: string;
  permissions?: string[];
  dependencies?: string[];
  publisher?: { id: string; name: string; verificationStatus: string } | null;
  createdAt: string;
};

export default function PluginsMarketplacePage() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ apiKey: string; signingSecret: string } | null>(null);

  const [publisherForm, setPublisherForm] = useState({
    name: "",
    email: "",
    website: "",
    defaultRevenueShareBps: "3000",
  });

  const [submissionForm, setSubmissionForm] = useState({
    publisherId: "",
    pluginName: "",
    version: "",
    channel: "stable",
    compatibility: "",
    changelog: "",
    bundleUrl: "https://plugins.example.com/bundles/plugin.tgz",
    signature: "",
    requestedPermissions: "products:read,plugins:execute",
    dependencies: "zod,axios",
    revenueShareBps: "",
    manifestJson: '{"hooks": ["onOrderCreated"], "uiSlots": ["admin.dashboard"]}',
  });

  async function load() {
    setError(null);
    const [publishersRes, submissionsRes, releasesRes] = await Promise.all([
      fetch("/api/plugins/publishers"),
      fetch("/api/plugins/submissions"),
      fetch("/api/plugins/releases"),
    ]);

    if (!publishersRes.ok) {
      throw new Error("failed to load publishers");
    }

    setPublishers(await publishersRes.json());
    setSubmissions(submissionsRes.ok ? await submissionsRes.json() : []);
    setReleases(releasesRes.ok ? await releasesRes.json() : []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const verifiedPublishers = useMemo(
    () => publishers.filter((publisher) => publisher.verificationStatus === "VERIFIED"),
    [publishers],
  );

  async function registerPublisher() {
    setMessage(null);
    setError(null);
    const response = await fetch("/api/plugins/publishers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: publisherForm.name,
        email: publisherForm.email,
        website: publisherForm.website || null,
        defaultRevenueShareBps: Number(publisherForm.defaultRevenueShareBps),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "publisher registration failed");
      return;
    }

    setCredentials({ apiKey: payload.apiKey, signingSecret: payload.signingSecret });
    setMessage(`Publisher created: ${payload.id}`);
    setPublisherForm({ name: "", email: "", website: "", defaultRevenueShareBps: "3000" });
    await load();
  }

  async function verifyPublisher(id: string, verified: boolean) {
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/plugins/publishers/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified, notes: verified ? "basic verification done" : "verification rejected" }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "verify action failed");
      return;
    }

    setMessage(`Publisher ${id} set to ${payload.verificationStatus}`);
    await load();
  }

  async function submitBundle() {
    setMessage(null);
    setError(null);

    let manifest: Record<string, any>;
    try {
      manifest = JSON.parse(submissionForm.manifestJson);
    } catch {
      setError("manifestJson is invalid JSON");
      return;
    }

    const response = await fetch("/api/plugins/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publisherId: submissionForm.publisherId,
        pluginName: submissionForm.pluginName,
        version: submissionForm.version,
        channel: submissionForm.channel,
        compatibility: submissionForm.compatibility || null,
        changelog: submissionForm.changelog || null,
        bundleUrl: submissionForm.bundleUrl,
        signature: submissionForm.signature,
        requestedPermissions: submissionForm.requestedPermissions
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        dependencies: submissionForm.dependencies
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        revenueShareBps: submissionForm.revenueShareBps ? Number(submissionForm.revenueShareBps) : undefined,
        manifest,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "submission failed");
      return;
    }

    setMessage(`Submission created: ${payload.id} (${payload.status})`);
    setSubmissionForm((prev) => ({
      ...prev,
      pluginName: "",
      version: "",
      signature: "",
      changelog: "",
    }));
    await load();
  }

  async function reviewSubmission(id: string, action: "approve" | "reject") {
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/plugins/submissions/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "review failed");
      return;
    }

    setMessage(`Submission ${id} ${payload.status}`);
    await load();
  }

  return (
    <main>
      <h1>Plugin Marketplace</h1>
      <p>Publisher onboarding, secure submissions, policy review pipeline and release approval.</p>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Publisher Registration</h2>
        <label>
          Name
          <input value={publisherForm.name} onChange={(e) => setPublisherForm((prev) => ({ ...prev, name: e.target.value }))} />
        </label>
        <label>
          Email
          <input value={publisherForm.email} onChange={(e) => setPublisherForm((prev) => ({ ...prev, email: e.target.value }))} />
        </label>
        <label>
          Website
          <input value={publisherForm.website} onChange={(e) => setPublisherForm((prev) => ({ ...prev, website: e.target.value }))} />
        </label>
        <label>
          Default Revenue Share (bps)
          <input
            value={publisherForm.defaultRevenueShareBps}
            onChange={(e) => setPublisherForm((prev) => ({ ...prev, defaultRevenueShareBps: e.target.value }))}
          />
        </label>
        <button onClick={registerPublisher}>Register Publisher</button>

        {credentials && (
          <pre style={{ marginTop: 12, background: "#f5f5f5", padding: 8 }}>
            {JSON.stringify(credentials, null, 2)}
          </pre>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Publishers</h2>
        {publishers.map((publisher) => (
          <div key={publisher.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{publisher.name}</strong> ({publisher.email}) - {publisher.verificationStatus}
            <span style={{ marginLeft: 12 }}>
              submissions: {publisher._count?.submissions ?? 0} / releases: {publisher._count?.releases ?? 0}
            </span>
            <div style={{ marginTop: 6 }}>
              <button onClick={() => verifyPublisher(publisher.id, true)}>Verify</button>
              <button style={{ marginLeft: 6 }} onClick={() => verifyPublisher(publisher.id, false)}>Reject</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Upload Signed Plugin Bundle</h2>
        <label>
          Publisher
          <select value={submissionForm.publisherId} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, publisherId: e.target.value }))}>
            <option value="">Select publisher</option>
            {verifiedPublishers.map((publisher) => (
              <option key={publisher.id} value={publisher.id}>{publisher.name}</option>
            ))}
          </select>
        </label>
        <label>
          Plugin Name
          <input value={submissionForm.pluginName} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, pluginName: e.target.value }))} />
        </label>
        <label>
          Version
          <input value={submissionForm.version} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, version: e.target.value }))} />
        </label>
        <label>
          Channel
          <select value={submissionForm.channel} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, channel: e.target.value }))}>
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>
        </label>
        <label>
          Compatibility
          <input value={submissionForm.compatibility} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, compatibility: e.target.value }))} />
        </label>
        <label>
          Bundle URL
          <input value={submissionForm.bundleUrl} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, bundleUrl: e.target.value }))} />
        </label>
        <label>
          Requested Permissions (CSV)
          <input value={submissionForm.requestedPermissions} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, requestedPermissions: e.target.value }))} />
        </label>
        <label>
          Dependencies (CSV)
          <input value={submissionForm.dependencies} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, dependencies: e.target.value }))} />
        </label>
        <label>
          Revenue Share (bps)
          <input value={submissionForm.revenueShareBps} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, revenueShareBps: e.target.value }))} />
        </label>
        <label>
          Manifest JSON
          <textarea rows={4} value={submissionForm.manifestJson} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, manifestJson: e.target.value }))} />
        </label>
        <label>
          Signature
          <input value={submissionForm.signature} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, signature: e.target.value }))} />
        </label>
        <label>
          Changelog
          <textarea rows={3} value={submissionForm.changelog} onChange={(e) => setSubmissionForm((prev) => ({ ...prev, changelog: e.target.value }))} />
        </label>
        <button onClick={submitBundle}>Submit for Review</button>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Review Pipeline</h2>
        {submissions.length === 0 && <p>No submissions.</p>}
        {submissions.map((submission) => (
          <details key={submission.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <summary>
              {submission.pluginName} {submission.version} ({submission.channel}) - {submission.status} - publisher {submission.publisher?.name ?? submission.publisherId}
            </summary>
            <p>Permissions: {submission.requestedPermissions.join(", ") || "-"}</p>
            <p>Dependencies: {submission.dependencies.join(", ") || "-"}</p>
            <p>Revenue share bps: {submission.revenueShareBps ?? "-"}</p>
            <p>Compatibility: {submission.compatibility ?? "-"}</p>
            <pre style={{ background: "#f6f6f6", padding: 8 }}>{JSON.stringify(submission.reviewReport, null, 2)}</pre>
            <button onClick={() => reviewSubmission(submission.id, "approve")}>Approve</button>
            <button style={{ marginLeft: 8 }} onClick={() => reviewSubmission(submission.id, "reject")}>Reject</button>
          </details>
        ))}
      </section>

      <section className="card">
        <h2>Releases and Compatibility</h2>
        {releases.map((release) => (
          <div key={release.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{release.name}</strong> {release.version} ({release.channel})
            <span style={{ marginLeft: 8 }}>compatibility: {release.compatibility ?? "-"}</span>
            <span style={{ marginLeft: 8 }}>review: {release.reviewStatus ?? "-"}</span>
            <span style={{ marginLeft: 8 }}>publisher: {release.publisher?.name ?? "-"}</span>
            <div>
              permissions: {release.permissions?.join(", ") || "-"}
            </div>
            <div>
              dependencies: {release.dependencies?.join(", ") || "-"}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
