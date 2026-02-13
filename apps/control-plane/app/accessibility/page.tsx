import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccessibilityPage() {
  const reports = await prisma.accessibilityReport.findMany({
    orderBy: { measuredAt: "desc" },
    take: 100,
    include: {
      installation: {
        select: {
          instanceId: true,
          domain: true,
        },
      },
    },
  });

  return (
    <main>
      <h1>Accessibility</h1>
      <p>WCAG/axe score by instance and version.</p>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Version</th>
              <th style={{ textAlign: "left" }}>Score</th>
              <th style={{ textAlign: "left" }}>Critical</th>
              <th style={{ textAlign: "left" }}>Serious</th>
              <th style={{ textAlign: "left" }}>Total</th>
              <th style={{ textAlign: "left" }}>Measured</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.installation?.instanceId ?? report.instanceId}</td>
                <td>{report.version}</td>
                <td>{Math.round(report.score)}</td>
                <td>{report.criticalViolations}</td>
                <td>{report.seriousViolations}</td>
                <td>{report.totalViolations}</td>
                <td>{new Date(report.measuredAt).toLocaleString()}</td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={7}>No accessibility reports yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
