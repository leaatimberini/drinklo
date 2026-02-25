import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { isAdminRequest } from "../../../../../lib/admin-auth";
import { buildInstallJobFromRequest, isInstallationVersionCompatible } from "../../../../../lib/plugin-marketplace-public";

export async function POST(req: NextRequest, ctx: any) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = ctx?.params?.id as string;
  const request = await prisma.pluginRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "request not found" }, { status: 404 });
  }

  const installation = await prisma.installation.findUnique({
    where: { instanceId: request.instanceId },
  });
  if (!installation) {
    return NextResponse.json({ error: "installation not found" }, { status: 404 });
  }

  if (request.version) {
    const release = await prisma.pluginRelease.findFirst({
      where: {
        name: request.pluginName,
        version: request.version,
        reviewStatus: "approved",
      },
    });
    if (!release) {
      return NextResponse.json({ error: "approved plugin release not found" }, { status: 404 });
    }
    const compatible = isInstallationVersionCompatible(
      installation.version,
      release.compatibility,
      (release as any).compatibilityMatrix,
    );
    if (!compatible) {
      return NextResponse.json({ error: "plugin release not compatible with installation version" }, { status: 409 });
    }
  }

  await prisma.pluginRequest.update({
    where: { id: request.id },
    data: { status: "approved", approvedAt: new Date() },
  });

  const job = await prisma.pluginJob.create({
    data: buildInstallJobFromRequest({
      installationId: installation.id,
      request: {
        id: request.id,
        instanceId: request.instanceId,
        pluginName: request.pluginName,
        version: request.version,
        action: request.action,
      },
      compatible: true,
    }),
  });

  return NextResponse.json({ jobId: job.id });
}
