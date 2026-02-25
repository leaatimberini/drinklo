import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

function fmt(date?: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default async function IntegrationBuilderDashboardPage() {
  const installations = await prisma.installation.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: { id: true, instanceId: true, clientName: true, domain: true, healthStatus: true, version: true },
  });
  const ids = installations.map((i) => i.id);
  const reports = ids.length
    ? await prisma.integrationBuilderReport.findMany({
        where: { installationId: { in: ids } },
        orderBy: { capturedAt: "desc" },
        take: 2000,
      })
    : [];
  const latest = new Map<string, (typeof reports)[number]>();
  for (const report of reports) {
    if (!report.installationId) continue;
    if (!latest.has(report.installationId)) latest.set(report.installationId, report);
  }

  return (
    <main>
      <h1>Integration Builder</h1>
      <p>Conectores custom por instancia: volumen, fallos y DLQ.</p>
      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Cliente</th>
              <th style={{ textAlign: "left" }}>Health</th>
              <th style={{ textAlign: "left" }}>Connectors</th>
              <th style={{ textAlign: "left" }}>Success 24h</th>
              <th style={{ textAlign: "left" }}>Failed 24h</th>
              <th style={{ textAlign: "left" }}>DLQ</th>
              <th style={{ textAlign: "left" }}>Last report</th>
            </tr>
          </thead>
          <tbody>
            {installations.map((inst) => {
              const r = latest.get(inst.id);
              return (
                <tr key={inst.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "8px 0" }}>{inst.instanceId}</td>
                  <td style={{ padding: "8px 0" }}>{inst.clientName ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{inst.healthStatus ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>
                    {r ? `${r.connectorsActive}/${r.connectorsTotal}` : "-"}
                  </td>
                  <td style={{ padding: "8px 0" }}>{r?.deliveriesSuccess24h ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{r?.deliveriesFailed24h ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{r?.dlqOpen ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{fmt(r?.capturedAt)}</td>
                </tr>
              );
            })}
            {installations.length === 0 && (
              <tr>
                <td colSpan={8}>No installations.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

