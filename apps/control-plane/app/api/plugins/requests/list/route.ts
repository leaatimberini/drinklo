import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const requests = await prisma.pluginRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "desc" },
    take: 200,
  });
  return NextResponse.json(requests);
}
