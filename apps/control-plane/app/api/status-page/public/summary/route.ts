import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { loadStatusPagePublicSummary } from "../../../../lib/status-page";

export async function GET() {
  const payload = await loadStatusPagePublicSummary(prisma as any);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
    },
  });
}

