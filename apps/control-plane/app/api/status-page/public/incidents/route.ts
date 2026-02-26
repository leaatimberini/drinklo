import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { loadStatusPagePublicSummary } from "../../../../lib/status-page";

export async function GET() {
  const payload = await loadStatusPagePublicSummary(prisma as any);
  return NextResponse.json({
    generatedAt: payload.generatedAt,
    active: payload.activeIncidents,
    recent: payload.recentIncidents,
  });
}

