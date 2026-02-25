import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { buildExpoBuildProfile, normalizeOtaChannel } from "../../../../lib/mobile-white-label";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  const items = await prisma.mobileBuildProfile.findMany({
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
  const requestedChannel = String(body.channel ?? "").trim() || null;
  const appVersion = String(body.appVersion ?? "0.1.0").trim();
  const runtimeVersion = String(body.runtimeVersion ?? appVersion).trim();
  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  const profile = await prisma.mobileBrandProfile.findUnique({
    where: { instanceId },
    include: { installation: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "brand profile not found" }, { status: 404 });
  }
  const channel = normalizeOtaChannel(requestedChannel, profile.installation.releaseChannel, profile.defaultChannel);
  const configUrlBase = process.env.CONTROL_PLANE_PUBLIC_BASE_URL;
  const configUrl = configUrlBase
    ? `${configUrlBase.replace(/\/+$/, "")}/api/mobile/white-label/config?instanceId=${encodeURIComponent(instanceId)}&channel=${encodeURIComponent(channel)}`
    : null;

  const generated = buildExpoBuildProfile({
    instanceId,
    appName: profile.appName,
    appSlug: profile.appSlug,
    channel,
    appVersion,
    runtimeVersion,
    apiBaseUrl: profile.apiBaseUrl ?? null,
    configUrl,
    assets: (profile.assets as any) ?? null,
  });

  const row = await prisma.mobileBuildProfile.create({
    data: {
      installationId: profile.installationId,
      brandProfileId: profile.id,
      instanceId,
      companyId: profile.companyId,
      profileName: generated.profileName,
      channel,
      runtimeVersion,
      appVersion,
      status: "GENERATED",
      config: generated as any,
      generatedBy: "admin",
    },
  });

  return NextResponse.json({ buildProfile: row, generated });
}

