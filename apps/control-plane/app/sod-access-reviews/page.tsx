import Link from "next/link";
import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

function fmtDate(value?: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default async function SodAccessReviewsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const instanceFilter = typeof sp.instanceId === "string" ? sp.instanceId.trim() : "";

  const installations = await prisma.installation.findMany({
    where: instanceFilter ? { instanceId: { contains: instanceFilter } } : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true,
      instanceId: true,
      clientName: true,
      domain: true,
      healthStatus: true,
      version: true,
      lastSeenAt: true,
    },
  });

  const installationIds = installations.map((i) => i.id);
  const instanceIds = installations.map((i) => i.instanceId);

  const reports = instanceIds.length
    ? await prisma.sodAccessReviewReport.findMany({
        where: { instanceId: { in: instanceIds } },
        orderBy: { capturedAt: "desc" },
        take: 2000,
      })
    : [];

  const alerts = installationIds.length
    ? await prisma.alert.findMany({
        where: {
          installationId: { in: installationIds },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          message: { contains: "SoD" },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      })
    : [];

  const latestByInstance = new Map<string, (typeof reports)[number]>();
  for (const report of reports) {
    if (!latestByInstance.has(report.instanceId)) {
      latestByInstance.set(report.instanceId, report);
    }
  }
  const alertCounts = new Map<string, number>();
  const instById = new Map(installations.map((i) => [i.id, i.instanceId]));
  for (const alert of alerts) {
    const instanceId = instById.get(alert.installationId);
    if (!instanceId) continue;
    alertCounts.set(instanceId, (alertCounts.get(instanceId) ?? 0) + 1);
  }

  return (
    <main>
      <h1>SoD & Access Reviews</h1>
      <p>Dashboard por instancia para segregacion de funciones (SoD) y campanas de revision de accesos.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="GET" style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label>
            Instance filter
            <input name="instanceId" defaultValue={instanceFilter} placeholder="inst-..." />
          </label>
          <button type="submit">Apply</button>
          <Link href="/installations">Installations</Link>
        </form>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instance</th>
              <th style={{ textAlign: "left" }}>Cliente</th>
              <th style={{ textAlign: "left" }}>Health</th>
              <th style={{ textAlign: "left" }}>SoD Policies</th>
              <th style={{ textAlign: "left" }}>Violations 24h</th>
              <th style={{ textAlign: "left" }}>Open Reviews</th>
              <th style={{ textAlign: "left" }}>Overdue</th>
              <th style={{ textAlign: "left" }}>Alerts 7d</th>
              <th style={{ textAlign: "left" }}>Last Report (BA)</th>
            </tr>
          </thead>
          <tbody>
            {installations.map((inst) => {
              const report = latestByInstance.get(inst.instanceId);
              return (
                <tr key={inst.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "8px 0" }}>{inst.instanceId}</td>
                  <td style={{ padding: "8px 0" }}>{inst.clientName ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{inst.healthStatus ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>
                    {report ? `${report.activePolicies}/${report.totalPolicies}` : "-"}
                  </td>
                  <td style={{ padding: "8px 0" }}>{report?.violations24h ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{report?.openCampaigns ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{report?.overdueCampaigns ?? "-"}</td>
                  <td style={{ padding: "8px 0" }}>{alertCounts.get(inst.instanceId) ?? 0}</td>
                  <td style={{ padding: "8px 0" }}>{fmtDate(report?.capturedAt)}</td>
                </tr>
              );
            })}
            {installations.length === 0 && (
              <tr>
                <td colSpan={9}>No installations.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
