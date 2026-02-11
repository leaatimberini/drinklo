import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Number(body.count ?? 5);
  const environment = String(body.environment ?? "staging");

  if (!Number.isFinite(count) || count <= 0) {
    return NextResponse.json({ error: "invalid count" }, { status: 400 });
  }

  const installations = await prisma.installation.findMany({
    orderBy: { lastHeartbeatAt: "desc" },
    take: count,
  });

  const created = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for (const inst of installations) {
    const recent = await prisma.restoreVerification.findFirst({
      where: {
        installationId: inst.id,
        environment,
        scheduledAt: { gt: sevenDaysAgo },
      },
    });
    if (recent) continue;
    const record = await prisma.restoreVerification.create({
      data: {
        installationId: inst.id,
        instanceId: inst.instanceId,
        environment,
        status: "scheduled",
      },
    });
    created.push(record.id);
  }

  return NextResponse.json({ scheduled: created.length, ids: created });
}
