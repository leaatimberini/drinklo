import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";
import { loadTrialAnalyticsDashboard } from "../../lib/trial-funnel-analytics";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const syncDerived = sp.get("sync") !== "0";
  const payload = await loadTrialAnalyticsDashboard(prisma as any, {
    from: sp.get("from"),
    to: sp.get("to"),
    syncDerived,
  });
  return NextResponse.json(payload);
}

