import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { defaultMobileTheme, mergeMobileTheme } from "../../../lib/mobile-white-label";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  const profiles = await prisma.mobileBrandProfile.findMany({
    where: instanceId ? { instanceId } : undefined,
    include: {
      installation: { select: { id: true, instanceId: true, clientName: true, domain: true, releaseChannel: true, version: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items: profiles });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const instanceId = String(body.instanceId ?? "").trim();
  const appName = String(body.appName ?? "").trim();
  const appSlug = String(body.appSlug ?? "").trim();
  if (!instanceId || !appName || !appSlug) {
    return NextResponse.json({ error: "instanceId, appName and appSlug are required" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({ where: { instanceId } });
  if (!installation) {
    return NextResponse.json({ error: "installation not found" }, { status: 404 });
  }

  const themeTokensInput = body.themeTokens && typeof body.themeTokens === "object" ? body.themeTokens : undefined;
  const profile = await prisma.mobileBrandProfile.upsert({
    where: { instanceId },
    create: {
      installationId: installation.id,
      instanceId,
      companyId: body.companyId ? String(body.companyId) : null,
      appName,
      appSlug,
      logoUrl: body.logoUrl ? String(body.logoUrl) : null,
      iconUrl: body.iconUrl ? String(body.iconUrl) : null,
      splashUrl: body.splashUrl ? String(body.splashUrl) : null,
      assets: body.assets && typeof body.assets === "object" ? body.assets : undefined,
      themeTokens: mergeMobileTheme(themeTokensInput),
      otaStableChannel: String(body.otaStableChannel ?? "stable"),
      otaBetaChannel: String(body.otaBetaChannel ?? "beta"),
      defaultChannel: String(body.defaultChannel ?? installation.releaseChannel ?? "stable"),
      apiBaseUrl: body.apiBaseUrl ? String(body.apiBaseUrl) : null,
      configVersion: Math.max(1, Number(body.configVersion ?? 1)),
    },
    update: {
      companyId: body.companyId ? String(body.companyId) : undefined,
      appName,
      appSlug,
      logoUrl: body.logoUrl === null ? null : body.logoUrl ? String(body.logoUrl) : undefined,
      iconUrl: body.iconUrl === null ? null : body.iconUrl ? String(body.iconUrl) : undefined,
      splashUrl: body.splashUrl === null ? null : body.splashUrl ? String(body.splashUrl) : undefined,
      assets: body.assets && typeof body.assets === "object" ? body.assets : undefined,
      themeTokens: themeTokensInput ? mergeMobileTheme(themeTokensInput) : undefined,
      otaStableChannel: body.otaStableChannel ? String(body.otaStableChannel) : undefined,
      otaBetaChannel: body.otaBetaChannel ? String(body.otaBetaChannel) : undefined,
      defaultChannel: body.defaultChannel ? String(body.defaultChannel) : undefined,
      apiBaseUrl: body.apiBaseUrl === null ? null : body.apiBaseUrl ? String(body.apiBaseUrl) : undefined,
      configVersion:
        body.bumpConfigVersion === true
          ? { increment: 1 }
          : body.configVersion != null
            ? Math.max(1, Number(body.configVersion))
            : undefined,
    },
  });

  return NextResponse.json({ profile, defaults: { themeTokens: defaultMobileTheme() } });
}

