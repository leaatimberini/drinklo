import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const instanceId = req.nextUrl.searchParams.get("instanceId") ?? undefined;
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const runs = await prisma.chaosRun.findMany({
    where: {
      instanceId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const byScenario = new Map<string, { total: number; failed: number; lastStatus: string | null; lastAt: Date | null }>();
  for (const run of runs) {
    const bucket = byScenario.get(run.scenario) ?? { total: 0, failed: 0, lastStatus: null, lastAt: null };
    bucket.total += 1;
    if (run.status !== "ok") {
      bucket.failed += 1;
    }
    if (!bucket.lastAt || run.createdAt > bucket.lastAt) {
      bucket.lastAt = run.createdAt;
      bucket.lastStatus = run.status;
    }
    byScenario.set(run.scenario, bucket);
  }

  const trends = Array.from(byScenario.entries()).map(([scenario, value]) => ({
    scenario,
    total: value.total,
    failed: value.failed,
    errorRate: value.total > 0 ? value.failed / value.total : 0,
    lastStatus: value.lastStatus,
    lastAt: value.lastAt,
  }));

  return NextResponse.json({ days, runs, trends });
}
