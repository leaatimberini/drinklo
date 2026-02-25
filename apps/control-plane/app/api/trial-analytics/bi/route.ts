import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { loadTrialAnalyticsDashboard } from "../../../lib/trial-funnel-analytics";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const data = await loadTrialAnalyticsDashboard(prisma as any, {
    from: sp.get("from"),
    to: sp.get("to"),
    syncDerived: sp.get("sync") !== "0",
  });

  return NextResponse.json({
    range: data.range,
    summary: data.summary,
    funnel: data.funnel,
    cohorts: data.cohorts,
    icp: data.icp,
    recentEvents: data.recentEvents,
  });
}

