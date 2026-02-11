import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 50);

  const restores = await prisma.restoreVerification.findMany({
    orderBy: { scheduledAt: "desc" },
    take: Number.isFinite(limit) ? limit : 50,
  });

  return NextResponse.json(restores);
}
