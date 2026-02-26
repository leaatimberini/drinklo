import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { prisma } from "../../../lib/prisma";
import { loadAcademyProgressDashboard } from "../../../lib/academy";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const payload = await loadAcademyProgressDashboard(prisma as any, {
    instanceId: sp.get("instanceId"),
    take: Number(sp.get("take") ?? 200),
  });
  return NextResponse.json(payload);
}

