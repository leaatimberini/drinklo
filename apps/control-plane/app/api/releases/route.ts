import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { isAdminRequest } from "../../lib/admin-auth";
import { verifyPayloadSignature } from "../../lib/signing";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await prisma.releaseManifest.findMany({
    orderBy: { releasedAt: "desc" },
    take: 50,
    select: { id: true, version: true, sha: true, channel: true, releasedAt: true },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const version = String(body.version ?? "").trim();
  const sha = String(body.sha ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const migrationsRequired = Boolean(
    body.migrations_required ?? body.migrationsRequired ?? false,
  );
  const breakingChanges = body.breaking_changes ?? body.breakingChanges ?? null;
  const releasedAt = body.released_at ?? body.releasedAt ?? null;
  const signature = String(body.signature ?? "").trim();

  if (!version || !sha || !channel || !signature) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const secret = process.env.CONTROL_PLANE_RELEASE_SIGNING_SECRET ?? "";
  const payload = {
    version,
    sha,
    channel,
    migrations_required: migrationsRequired,
    breaking_changes: breakingChanges,
    released_at: releasedAt,
  };
  if (!verifyPayloadSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const manifest = await prisma.releaseManifest.create({
    data: {
      version,
      sha,
      channel,
      migrationsRequired,
      breakingChanges,
      releasedAt: releasedAt ? new Date(releasedAt) : undefined,
      signature,
    },
  });

  return NextResponse.json({ id: manifest.id });
}
