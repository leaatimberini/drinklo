import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";
import { ensureFinOpsPricingDefaults } from "../../lib/finops";

function toNum(value: bigint | null | undefined) {
  return value == null ? null : Number(value);
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureFinOpsPricingDefaults();

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [installations, pricing, recentSnapshots, alerts] = await Promise.all([
    prisma.installation.findMany({
      orderBy: { estimatedMonthlyCostUsd: "desc" },
      take: 200,
      select: {
        id: true,
        instanceId: true,
        clientName: true,
        domain: true,
        releaseChannel: true,
        estimatedMonthlyCostUsd: true,
        cpuUsagePct: true,
        memoryUsedBytes: true,
        memoryTotalBytes: true,
        diskUsedBytes: true,
        diskTotalBytes: true,
        dbSizeBytes: true,
        storageSizeBytes: true,
        jobsProcessed1h: true,
        jobsPending: true,
        finopsUpdatedAt: true,
      },
    }),
    prisma.finOpsPricing.findMany({ orderBy: { resourceKey: "asc" } }),
    prisma.finOpsSnapshot.findMany({
      where: { recordedAt: { gte: since } },
      orderBy: { recordedAt: "desc" },
      take: 4000,
      select: {
        installationId: true,
        estimatedMonthlyCostUsd: true,
        recordedAt: true,
      },
    }),
    prisma.alert.findMany({
      where: {
        createdAt: { gte: since },
        message: { contains: "FinOps anomaly:" },
      },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        id: true,
        installationId: true,
        level: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);

  const byInstallation = new Map<string, Array<number>>();
  for (const row of recentSnapshots) {
    const list = byInstallation.get(row.installationId) ?? [];
    if (row.estimatedMonthlyCostUsd != null) {
      list.push(row.estimatedMonthlyCostUsd);
    }
    byInstallation.set(row.installationId, list);
  }

  const items = installations.map((inst) => {
    const samples = byInstallation.get(inst.id) ?? [];
    const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
    const max = samples.length ? Math.max(...samples) : null;
    return {
      installationId: inst.id,
      instanceId: inst.instanceId,
      clientName: inst.clientName,
      domain: inst.domain,
      releaseChannel: inst.releaseChannel,
      estimatedMonthlyCostUsd: inst.estimatedMonthlyCostUsd,
      estimatedMonthlyCostAvgUsd: avg,
      estimatedMonthlyCostMaxUsd: max,
      cpuUsagePct: inst.cpuUsagePct,
      memoryUsedBytes: toNum(inst.memoryUsedBytes),
      memoryTotalBytes: toNum(inst.memoryTotalBytes),
      diskUsedBytes: toNum(inst.diskUsedBytes),
      diskTotalBytes: toNum(inst.diskTotalBytes),
      dbSizeBytes: toNum(inst.dbSizeBytes),
      storageSizeBytes: toNum(inst.storageSizeBytes),
      jobsProcessed1h: inst.jobsProcessed1h,
      jobsPending: inst.jobsPending,
      finopsUpdatedAt: inst.finopsUpdatedAt,
    };
  });

  const totals = items.reduce(
    (acc, item) => {
      acc.estimatedMonthlyCostUsd += Number(item.estimatedMonthlyCostUsd ?? 0);
      acc.dbSizeBytes += Number(item.dbSizeBytes ?? 0);
      acc.storageSizeBytes += Number(item.storageSizeBytes ?? 0);
      return acc;
    },
    { estimatedMonthlyCostUsd: 0, dbSizeBytes: 0, storageSizeBytes: 0 },
  );

  return NextResponse.json({
    rangeDays: days,
    totals,
    items,
    pricing,
    alerts,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const entries = Array.isArray(body?.pricing) ? body.pricing : [];
  if (!entries.length) {
    return NextResponse.json({ error: "pricing required" }, { status: 400 });
  }

  const updates = [];
  for (const entry of entries) {
    const resourceKey = String(entry.resourceKey ?? "").trim();
    const unit = String(entry.unit ?? "unit").trim();
    const usdPerUnit = Number(entry.usdPerUnit);
    const description = entry.description != null ? String(entry.description) : null;
    const enabled = entry.enabled == null ? true : Boolean(entry.enabled);
    if (!resourceKey || !Number.isFinite(usdPerUnit) || usdPerUnit < 0) {
      continue;
    }
    updates.push(
      prisma.finOpsPricing.upsert({
        where: { resourceKey },
        update: { unit, usdPerUnit, description, enabled },
        create: { resourceKey, unit, usdPerUnit, description, enabled },
      }),
    );
  }

  await Promise.all(updates);
  const pricing = await prisma.finOpsPricing.findMany({ orderBy: { resourceKey: "asc" } });
  return NextResponse.json({ ok: true, count: updates.length, pricing });
}

