import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { buildWhiteLabelMobileConfig } from "../../../../lib/mobile-white-label";

export async function GET(req: NextRequest) {
  const instanceId = String(req.nextUrl.searchParams.get("instanceId") ?? "").trim();
  const requestedChannel = req.nextUrl.searchParams.get("channel");
  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  const profile = await prisma.mobileBrandProfile.findUnique({
    where: { instanceId },
    include: {
      installation: {
        select: {
          id: true,
          instanceId: true,
          releaseChannel: true,
          version: true,
          domain: true,
        },
      },
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "brand profile not found" }, { status: 404 });
  }

  const latestUpdate = await prisma.mobileOtaUpdate.findFirst({
    where: { instanceId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  const config = buildWhiteLabelMobileConfig({
    instanceId: profile.instanceId,
    companyId: profile.companyId,
    appName: profile.appName,
    appSlug: profile.appSlug,
    logoUrl: profile.logoUrl,
    iconUrl: profile.iconUrl,
    splashUrl: profile.splashUrl,
    assets: (profile.assets as any) ?? null,
    apiBaseUrl: profile.apiBaseUrl ?? (profile.installation.domain ? `https://${profile.installation.domain}` : null),
    themeTokens: (profile.themeTokens as any) ?? undefined,
    configVersion: profile.configVersion,
    ota: {
      provider: "eas",
      stableChannel: profile.otaStableChannel,
      betaChannel: profile.otaBetaChannel,
      requestedChannel,
      installationReleaseChannel: latestUpdate?.rolloutChannel ?? profile.installation.releaseChannel ?? profile.defaultChannel,
      runtimeVersion: latestUpdate?.runtimeVersion ?? profile.installation.version ?? "0.1.0",
      appVersion: latestUpdate?.targetVersion ?? profile.installation.version ?? "0.1.0",
      updateUrl: process.env.MOBILE_OTA_UPDATE_URL ?? null,
    },
  });

  return NextResponse.json({
    config,
    meta: {
      profileId: profile.id,
      latestUpdateId: latestUpdate?.id ?? null,
      latestPublishedAt: latestUpdate?.createdAt ?? null,
    },
  });
}
