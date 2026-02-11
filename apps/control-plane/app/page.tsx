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

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Client</th>
              <th style={{ textAlign: "left" }}>Domain</th>
              <th style={{ textAlign: "left" }}>Version</th>
              <th style={{ textAlign: "left" }}>Channel</th>
              <th style={{ textAlign: "left" }}>Health</th>
              <th style={{ textAlign: "left" }}>p95 ms</th>
              <th style={{ textAlign: "left" }}>Error Rate</th>
              <th style={{ textAlign: "left" }}>Webhook Retry</th>
              <th style={{ textAlign: "left" }}>Events 1h</th>
              <th style={{ textAlign: "left" }}>Events Fail</th>
              <th style={{ textAlign: "left" }}>Events Lag</th>
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
                <td>{inst.lastSeenAt ? new Date(inst.lastSeenAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
