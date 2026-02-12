import { prisma } from "../../lib/prisma";
import Link from "next/link";

export default async function InstallationDetail({ params }: { params: { id: string } }) {
  const installation = await prisma.installation.findUnique({ where: { id: params.id } });
  if (!installation) {
    return (
      <main>
        <p>Installation not found.</p>
        <Link href="/">Back</Link>
      </main>
    );
  }

  const jobs = await prisma.jobFailure.findMany({
    where: { installationId: installation.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const alerts = await prisma.alert.findMany({
    where: { installationId: installation.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const [invalidations, vitals] = await Promise.all([
    prisma.edgeInvalidation.findMany({
      where: { installationId: installation.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    prisma.webVitalSample.findMany({
      where: { installationId: installation.id, name: { in: ["LCP", "TTFB"] } },
      orderBy: { capturedAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <main>
      <Link href="/">? Back</Link>
      <h1>{installation.instanceId}</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <p><strong>Client:</strong> {installation.clientName ?? "-"}</p>
        <p><strong>Domain:</strong> {installation.domain ?? "-"}</p>
        <p><strong>Version:</strong> {installation.version ?? "-"}</p>
        <p><strong>Release:</strong> {installation.releaseChannel ?? "-"}</p>
        <p><strong>Primary region:</strong> {installation.primaryRegion ?? "-"}</p>
        <p><strong>Health:</strong> {installation.healthStatus ?? "-"}</p>
        <p><strong>Last seen:</strong> {installation.lastSeenAt ? new Date(installation.lastSeenAt).toLocaleString() : "-"}</p>
        <p><strong>Last backup:</strong> {installation.lastBackupAt ? new Date(installation.lastBackupAt).toLocaleString() : "-"}</p>
        <p><strong>Backup status:</strong> {installation.backupStatus ?? "-"}</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Regional health</h3>
        {Array.isArray(installation.regionalHealth) && installation.regionalHealth.length > 0 ? (
          <ul>
            {installation.regionalHealth.map((sample: any) => (
              <li key={`${sample.region}-${sample.checked_at}`}>
                {sample.region} [{sample.role ?? "secondary"}]: {sample.ok ? "OK" : "FAIL"}
                {sample.latency_ms != null ? ` (${sample.latency_ms}ms)` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>No regional probes reported yet.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Job failures</h3>
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>{job.message} ({job.createdAt.toISOString()})</li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Edge invalidations</h3>
        <ul>
          {invalidations.map((item) => (
            <li key={item.id}>
              {item.reason} ({item.status}) - {item.paths.slice(0, 3).join(", ")} ({item.requestedAt.toISOString()})
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Web vitals (LCP/TTFB)</h3>
        <ul>
          {vitals.map((sample) => (
            <li key={sample.id}>
              {sample.name}: {Math.round(sample.value)}ms {sample.path ? `(${sample.path})` : ""} ({sample.capturedAt.toISOString()})
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Alerts</h3>
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>{alert.level}: {alert.message} ({alert.createdAt.toISOString()})</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
