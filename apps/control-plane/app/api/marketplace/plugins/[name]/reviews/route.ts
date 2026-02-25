import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req: NextRequest, ctx: any) {
  const pluginName = decodeURIComponent(String(ctx?.params?.name ?? ""));
  if (!pluginName) {
    return NextResponse.json({ error: "plugin name required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rating = Number(body.rating);
  const reviewerName = String(body.reviewerName ?? "").trim();
  const title = body.title ? String(body.title).slice(0, 140) : null;
  const reviewBody = body.body ? String(body.body).slice(0, 4000) : null;
  const version = body.version ? String(body.version).trim() : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !reviewerName) {
    return NextResponse.json({ error: "invalid review payload" }, { status: 400 });
  }

  const release = await prisma.pluginRelease.findFirst({
    where: {
      name: pluginName,
      reviewStatus: "approved",
      ...(version ? { version } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!release) {
    return NextResponse.json({ error: "plugin release not found" }, { status: 404 });
  }

  const review = await prisma.pluginMarketplaceReview.create({
    data: {
      pluginName,
      releaseId: release.id,
      version: release.version,
      rating,
      title,
      body: reviewBody,
      reviewerName,
      status: "PUBLISHED",
    },
  });

  return NextResponse.json({ id: review.id, status: review.status });
}

