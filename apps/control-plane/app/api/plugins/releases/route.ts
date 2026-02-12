import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { verifyPluginReleaseSignature } from "../../../lib/plugin-marketplace";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const version = String(body.version ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const compatibility = body.compatibility ?? null;
  const changelog = body.changelog ?? null;
  const signature = String(body.signature ?? "").trim();
  const permissions = Array.isArray(body.permissions) ? body.permissions.map((x: any) => String(x)) : [];
  const dependencies = Array.isArray(body.dependencies) ? body.dependencies.map((x: any) => String(x)) : [];
  const publisherId = body.publisherId ? String(body.publisherId) : null;

  if (!name || !version || !channel || !signature) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const secret = process.env.PLUGIN_MARKETPLACE_SIGNING_SECRET ?? "";
  const payload = { name, version, channel, compatibility, changelog };
  if (!verifyPluginReleaseSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const release = await prisma.pluginRelease.create({
    data: {
      name,
      version,
      channel,
      compatibility,
      changelog,
      signature,
      permissions,
      dependencies,
      publisherId,
      reviewStatus: "approved",
    },
  });

  return NextResponse.json({ id: release.id });
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
