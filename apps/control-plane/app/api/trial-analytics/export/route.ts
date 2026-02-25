import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { buildTrialAnalyticsCsv, loadTrialAnalyticsDashboard } from "../../../lib/trial-funnel-analytics";

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
  const csv = buildTrialAnalyticsCsv(data);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trial-funnel-${data.range.from}-${data.range.to}.csv"`,
    },
  });
}

