import { prisma } from "./lib/prisma";
import Link from "next/link";

export default async function Home() {
  const installations = await prisma.installation.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });
  const securityReports = await prisma.securityReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const drills = await prisma.disasterRecoveryDrill.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  const [recentInvalidations, recentVitals] = await Promise.all([
    prisma.edgeInvalidation.findMany({
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    prisma.webVitalSample.findMany({
      where: { name: { in: ["LCP", "TTFB"] } },
      orderBy: { capturedAt: "desc" },
      take: 100,
    }),
  ]);
  const chaosRuns = await prisma.chaosRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const vitalsByName = recentVitals.reduce(
    (acc, item) => {
      const bucket = acc[item.name] ?? { sum: 0, count: 0 };
      bucket.sum += item.value;
      bucket.count += 1;
      acc[item.name] = bucket;
      return acc;
    },
    {} as Record<string, { sum: number; count: number }>,
  );

  return (
    <main>
      <h1>Control Plane</h1>
      <p>Installations overview</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <Link href="/login">Switch role</Link>
        {" | "}
        <Link href="/plugins">Marketplace</Link>
        {" | "}
        <Link href="/billing">Billing</Link>
        {" | "}
        <Link href="/rollouts">Rollouts</Link>
        {" | "}
        <Link href="/finops">FinOps</Link>
        {" | "}
        <Link href="/audit">Audit</Link>
        {" | "}
        <Link href="/developer-portal">Developer Portal</Link>
        {" | "}
        <Link href="/sandbox">Sandbox</Link>
        {" | "}
        <Link href="/compliance-evidence">Compliance Evidence</Link>
        {" | "}
        <Link href="/security-dast">DAST Findings</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Security Reports</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Kind</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "left" }}>Repo</th>
              <th style={{ textAlign: "left" }}>SHA</th>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {securityReports.map((report) => (
              <tr key={report.id}>
                <td>{report.kind}</td>
                <td>{report.status}</td>
                <td>{report.repo ?? "-"}</td>
                <td>{report.sha ? report.sha.slice(0, 7) : "-"}</td>
                <td>{report.instanceId ?? "-"}</td>
                <td>{new Date(report.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>DR Drills</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "left" }}>RPO (min)</th>
              <th style={{ textAlign: "left" }}>RTO (min)</th>
              <th style={{ textAlign: "left" }}>Started</th>
              <th style={{ textAlign: "left" }}>Finished</th>
            </tr>
          </thead>
          <tbody>
            {drills.map((drill) => (
              <tr key={drill.id}>
                <td>{drill.instanceId}</td>
                <td>{drill.status}</td>
                <td>{drill.rpoMinutes ?? "-"}</td>
                <td>{drill.rtoMinutes ?? "-"}</td>
                <td>{new Date(drill.startedAt).toLocaleString()}</td>
                <td>{drill.finishedAt ? new Date(drill.finishedAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Edge Cache</h2>
        <p>Invalidations (last 20): {recentInvalidations.length}</p>
        <p>
          Avg LCP:{" "}
          {vitalsByName.LCP?.count
            ? `${Math.round(vitalsByName.LCP.sum / vitalsByName.LCP.count)} ms`
            : "-"}
        </p>
        <p>
          Avg TTFB:{" "}
          {vitalsByName.TTFB?.count
            ? `${Math.round(vitalsByName.TTFB.sum / vitalsByName.TTFB.count)} ms`
            : "-"}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Chaos & Resilience</h2>
        <p>Recent runs: {chaosRuns.length}</p>
        <ul>
          {chaosRuns.slice(0, 8).map((run) => (
            <li key={run.id}>
              {run.instanceId} - {run.scenario} - {run.status} ({new Date(run.createdAt).toLocaleString()})
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Client</th>
              <th style={{ textAlign: "left" }}>Domain</th>
              <th style={{ textAlign: "left" }}>Version</th>
              <th style={{ textAlign: "left" }}>Channel</th>
              <th style={{ textAlign: "left" }}>Primary Region</th>
              <th style={{ textAlign: "left" }}>Regional Health</th>
              <th style={{ textAlign: "left" }}>Health</th>
              <th style={{ textAlign: "left" }}>p95 ms</th>
              <th style={{ textAlign: "left" }}>Error Rate</th>
              <th style={{ textAlign: "left" }}>Webhook Retry</th>
              <th style={{ textAlign: "left" }}>Events 1h</th>
              <th style={{ textAlign: "left" }}>Events Fail</th>
              <th style={{ textAlign: "left" }}>Events Lag</th>
              <th style={{ textAlign: "left" }}>IAM</th>
              <th style={{ textAlign: "left" }}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {installations.map((inst) => (
              <tr key={inst.id}>
                <td><Link href={`/installations/${inst.id}`}>{inst.instanceId}</Link></td>
                <td>{inst.clientName ?? "-"}</td>
                <td>{inst.domain ?? "-"}</td>
                <td>{inst.version ?? "-"}</td>
                <td>{inst.releaseChannel ?? "-"}</td>
                <td>{inst.primaryRegion ?? "-"}</td>
                <td>
                  {Array.isArray(inst.regionalHealth)
                    ? `${inst.regionalHealth.filter((region: any) => region?.ok).length}/${inst.regionalHealth.length} OK`
                    : "-"}
                </td>
                <td>{inst.healthStatus ?? "-"}</td>
                <td>{inst.sloP95Ms ? Math.round(inst.sloP95Ms) : "-"}</td>
                <td>{inst.sloErrorRate ? `${(inst.sloErrorRate * 100).toFixed(2)}%` : "-"}</td>
                <td>
                  {inst.sloWebhookRetryRate
                    ? `${(inst.sloWebhookRetryRate * 100).toFixed(2)}%`
                    : "-"}
                </td>
                <td>{inst.eventsTotal1h ?? "-"}</td>
                <td>{inst.eventsFailed1h ?? "-"}</td>
                <td>{inst.eventsAvgLagMs != null ? `${inst.eventsAvgLagMs}ms` : "-"}</td>
                <td>
                  {inst.iamSsoEnabled ? "SSO " : ""}
                  {inst.iamMfaEnforced ? "MFA " : ""}
                  {inst.iamScimEnabled ? "SCIM" : ""}
                </td>
                <td>{inst.lastSeenAt ? new Date(inst.lastSeenAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
