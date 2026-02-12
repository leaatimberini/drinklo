import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.installation.findMany({
    orderBy: { estimatedMonthlyCostUsd: "desc" },
    select: {
      instanceId: true,
      clientName: true,
      domain: true,
      releaseChannel: true,
      estimatedMonthlyCostUsd: true,
      cpuUsagePct: true,
      memoryUsedBytes: true,
      diskUsedBytes: true,
      dbSizeBytes: true,
      storageSizeBytes: true,
      jobsProcessed1h: true,
      jobsPending: true,
      finopsUpdatedAt: true,
    },
  });

  const header = [
    "instance_id",
    "client",
    "domain",
    "channel",
    "estimated_monthly_cost_usd",
    "cpu_usage_pct",
    "memory_used_bytes",
    "disk_used_bytes",
    "db_size_bytes",
    "storage_size_bytes",
    "jobs_processed_1h",
    "jobs_pending",
    "finops_updated_at",
  ];

  const csv = [
    header.join(","),
    ...rows.map((row) => [
      row.instanceId,
      row.clientName ?? "",
      row.domain ?? "",
      row.releaseChannel ?? "",
      row.estimatedMonthlyCostUsd ?? "",
      row.cpuUsagePct ?? "",
      row.memoryUsedBytes != null ? row.memoryUsedBytes.toString() : "",
      row.diskUsedBytes != null ? row.diskUsedBytes.toString() : "",
      row.dbSizeBytes != null ? row.dbSizeBytes.toString() : "",
      row.storageSizeBytes != null ? row.storageSizeBytes.toString() : "",
      row.jobsProcessed1h ?? "",
      row.jobsPending ?? "",
      row.finopsUpdatedAt ? row.finopsUpdatedAt.toISOString() : "",
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finops-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

