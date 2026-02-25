import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: "direct release creation disabled: use /api/plugins/submissions + review pipeline",
    },
    { status: 409 },
  );
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const releases = await prisma.pluginRelease.findMany({
    where: channel ? { channel } : undefined,
    include: {
      publisher: {
        select: {
          id: true,
          name: true,
          verificationStatus: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(releases);
}
