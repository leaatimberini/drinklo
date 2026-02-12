"use client";

import { useEffect, useMemo, useState } from "react";
import { summarizeFindings } from "../lib/dast-view";

type Finding = {
  id: string;
  severity: string;
  status: string;
  title: string;
  route: string;
  target: string;
  evidence?: string | null;
  recommendation?: string | null;
  zapRuleId: string;
  slaDueAt?: string | null;
  lastSeenAt: string;
  installation?: { instanceId: string; domain?: string | null } | null;
};

function severityOrder(severity: string) {
  const table: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return table[String(severity).toLowerCase()] ?? 5;
}

export default function SecurityDastPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (severityFilter !== "all") params.set("severity", severityFilter);
    params.set("limit", "500");

    const res = await fetch(`/api/security-report/dast-findings?${params.toString()}`);
    const payload = await res.json().catch(() => []);
    if (!res.ok) {
      setError(payload.error ?? "failed to load findings");
      return;
    }
    setFindings(payload as Finding[]);
  }

  useEffect(() => {
    load();
  }, [statusFilter, severityFilter]);

  const counts = useMemo(() => summarizeFindings(findings), [findings]);

  async function setStatus(id: string, status: "open" | "triaged" | "fixed") {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/security-report/dast-findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "update failed");
      return;
    }
    setMessage(`Finding ${id} -> ${status}`);
    await load();
  }

  return (
    <main>
      <h1>DAST Findings</h1>
      <p>Continuous OWASP ZAP findings from staging scans.</p>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">all</option>
            <option value="open">open</option>
            <option value="triaged">triaged</option>
            <option value="fixed">fixed</option>
          </select>
        </label>
        <label>
          Severity
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">all</option>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="info">info</option>
          </select>
        </label>
        <div style={{ marginTop: 8 }}>
          {Object.entries(counts.bySeverity).map(([key, value]) => (
            <span key={`sev-${key}`} style={{ marginRight: 8 }}>severity:{key}={value}</span>
          ))}
          {Object.entries(counts.byStatus).map(([key, value]) => (
            <span key={`status-${key}`} style={{ marginRight: 8 }}>status:{key}={value}</span>
          ))}
        </div>
      </section>

      <section className="card">
        {findings.length === 0 && <p>No findings.</p>}
        {findings
          .slice()
          .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
          .map((finding) => (
            <details key={finding.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
              <summary>
                [{finding.severity.toUpperCase()}] {finding.title} - {finding.status} - {finding.route}
              </summary>
              <p>Target: {finding.target}</p>
              <p>Rule: {finding.zapRuleId}</p>
              <p>Instance: {finding.installation?.instanceId ?? "-"}</p>
              <p>SLA due: {finding.slaDueAt ? new Date(finding.slaDueAt).toLocaleDateString() : "-"}</p>
              <p>Last seen: {new Date(finding.lastSeenAt).toLocaleString()}</p>
              <p>Evidence: {finding.evidence ?? "-"}</p>
              <p>Recommendation: {finding.recommendation ?? "-"}</p>
              <div>
                <button onClick={() => setStatus(finding.id, "open")}>Open</button>
                <button style={{ marginLeft: 6 }} onClick={() => setStatus(finding.id, "triaged")}>Triaged</button>
                <button style={{ marginLeft: 6 }} onClick={() => setStatus(finding.id, "fixed")}>Fixed</button>
              </div>
            </details>
          ))}
      </section>
    </main>
  );
}
