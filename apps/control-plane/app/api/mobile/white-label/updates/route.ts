import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { buildMobileOtaPublication } from "../../../../lib/mobile-white-label";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  const items = await prisma.mobileOtaUpdate.findMany({
    where: instanceId ? { instanceId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const instanceId = String(body.instanceId ?? "").trim();
  const targetVersion = String(body.targetVersion ?? "").trim();
  const runtimeVersion = String(body.runtimeVersion ?? targetVersion).trim();
  if (!instanceId || !targetVersion || !runtimeVersion) {
    return NextResponse.json({ error: "instanceId, targetVersion, runtimeVersion required" }, { status: 400 });
  }

  const profile = await prisma.mobileBrandProfile.findUnique({
    where: { instanceId },
    include: { installation: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "brand profile not found" }, { status: 404 });
  }

  const publication = buildMobileOtaPublication({
    instanceId,
    requestedChannel: body.channel ? String(body.channel) : null,
    installationReleaseChannel: profile.installation.releaseChannel ?? null,
    stableChannel: profile.otaStableChannel,
    betaChannel: profile.otaBetaChannel,
    targetVersion,
    runtimeVersion,
    releaseId: body.releaseId ? String(body.releaseId) : null,
    message: body.message ? String(body.message) : null,
  });

  const row = await prisma.mobileOtaUpdate.create({
    data: {
      installationId: profile.installationId,
      brandProfileId: profile.id,
      instanceId,
      companyId: profile.companyId,
      channel: publication.channel,
      targetVersion: publication.targetVersion,
      runtimeVersion: publication.runtimeVersion,
      rolloutChannel: publication.rolloutChannel,
      releaseId: publication.releaseId,
      status: publication.status,
      message: publication.message,
      manifest: {
        otaChannelName: publication.otaChannelName,
        provider: "eas",
        publishedAt: new Date().toISOString(),
        approvalRequired: false,
      },
      publishedBy: "admin",
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });

  return NextResponse.json({ update: row, publication });
}

