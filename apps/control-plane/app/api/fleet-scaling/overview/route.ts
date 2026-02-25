import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { buildFleetInstanceScaling, summarizeShardDistribution } from "../../../lib/fleet-scaling";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const take = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("take") ?? 200)));
  const installations = await prisma.installation.findMany({
    orderBy: { updatedAt: "desc" },
    take,
  });
  const billingAccounts = await prisma.billingAccount.findMany({
    where: { instanceId: { in: installations.map((i) => i.instanceId) } },
    include: { plan: true },
  });
  const accountByInstance = new Map(billingAccounts.map((a) => [a.instanceId, a]));

  const items = installations.map((inst) =>
    buildFleetInstanceScaling({
      instanceId: inst.instanceId,
      planName: accountByInstance.get(inst.instanceId)?.plan?.name ?? null,
      monthlyOrders: accountByInstance.get(inst.instanceId)?.monthlyOrders ?? null,
      eventsTotal1h: inst.eventsTotal1h ?? null,
      jobsProcessed1h: inst.jobsProcessed1h ?? null,
      jobsPending: inst.jobsPending ?? null,
      storageSizeBytes: inst.storageSizeBytes ?? null,
      cpuUsagePct: inst.cpuUsagePct ?? null,
      memoryUsedBytes: inst.memoryUsedBytes ?? null,
      memoryTotalBytes: inst.memoryTotalBytes ?? null,
    }),
  );

  const shardDistribution = summarizeShardDistribution(installations.map((i) => i.instanceId));
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [webVitalShards, featureUsageShards, integrationBuilderShards] = await Promise.all([
    prisma.webVitalSample
      .groupBy({
        by: ["shardKey"],
        where: { capturedAt: { gte: since24h } },
        _count: { _all: true },
      })
      .catch(() => []),
    prisma.featureUsageSample
      .groupBy({
        by: ["shardKey"],
        where: { capturedAt: { gte: since24h } },
        _count: { _all: true },
      })
      .catch(() => []),
    prisma.integrationBuilderReport
      .groupBy({
        by: ["shardKey"],
        where: { capturedAt: { gte: since24h } },
        _count: { _all: true },
      })
      .catch(() => []),
  ]);

  const quotaSummary = items.reduce(
    (acc, item) => {
      const plan = item.quota.normalizedPlan;
      acc.byPlan[plan] += 1;
      if (!item.quotaCheck.ok) acc.quotaViolations += 1;
      return acc;
    },
    {
      totalInstances: items.length,
      quotaViolations: 0,
      byPlan: { starter: 0, pro: 0, enterprise: 0 },
    } as {
      totalInstances: number;
      quotaViolations: number;
      byPlan: Record<"starter" | "pro" | "enterprise", number>;
    },
  );

  return NextResponse.json({
    quotaSummary,
    shardDistribution,
    metricsShards24h: {
      webVitals: webVitalShards,
      featureUsage: featureUsageShards,
      integrationBuilder: integrationBuilderShards,
    },
    items: items.sort((a, b) => b.tuning.score - a.tuning.score).slice(0, take),
  });
}

