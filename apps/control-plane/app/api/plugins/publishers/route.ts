import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";

function randomToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await prisma.publisher.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      website: true,
      verificationStatus: true,
      verificationNotes: true,
      verifiedAt: true,
      defaultRevenueShareBps: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          submissions: true,
          releases: true,
        },
      },
    },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const website = body.website ? String(body.website).trim() : null;
  const defaultRevenueShareBps = body.defaultRevenueShareBps == null ? null : Number(body.defaultRevenueShareBps);

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  const apiKey = randomToken("pub");
  const signingSecret = randomToken("pubsig");

  const created = await prisma.publisher.create({
    data: {
      name,
      email,
      website,
      verificationStatus: "PENDING",
      apiKey,
      signingSecret,
      defaultRevenueShareBps: Number.isFinite(defaultRevenueShareBps) ? defaultRevenueShareBps : null,
    },
  });

  return NextResponse.json({
    id: created.id,
    apiKey,
    signingSecret,
    verificationStatus: created.verificationStatus,
    warning: "Store credentials now; signing secret will not be shown again in UI list.",
  });
}
