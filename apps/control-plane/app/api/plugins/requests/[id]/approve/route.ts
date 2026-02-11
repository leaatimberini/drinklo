import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const request = await prisma.pluginRequest.findUnique({ where: { id: params.id } });
  if (!request) {
    return NextResponse.json({ error: "request not found" }, { status: 404 });
  }

  const installation = await prisma.installation.findUnique({
    where: { instanceId: request.instanceId },
  });
  if (!installation) {
    return NextResponse.json({ error: "installation not found" }, { status: 404 });
  }

  await prisma.pluginRequest.update({
    where: { id: request.id },
    data: { status: "approved", approvedAt: new Date() },
  });

  const job = await prisma.pluginJob.create({
    data: {
      installationId: installation.id,
      instanceId: request.instanceId,
      pluginName: request.pluginName,
      version: request.version ?? undefined,
      action: request.action,
      status: "pending",
    },
  });

  return NextResponse.json({ jobId: job.id });
}
