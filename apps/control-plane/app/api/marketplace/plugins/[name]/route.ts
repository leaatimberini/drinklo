import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeRatingSummary } from "../../../../lib/plugin-marketplace-public";

export async function GET(_req: NextRequest, ctx: any) {
  const name = decodeURIComponent(String(ctx?.params?.name ?? ""));
  if (!name) {
    return NextResponse.json({ error: "plugin name required" }, { status: 400 });
  }

  const releases = await prisma.pluginRelease.findMany({
    where: { name, reviewStatus: "approved" },
    include: {
      publisher: { select: { id: true, name: true, verificationStatus: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  if (releases.length === 0) {
    return NextResponse.json({ error: "plugin not found" }, { status: 404 });
  }

  const allReviews = releases.flatMap((r) => r.reviews);
  return NextResponse.json({
    plugin: {
      name,
      latest: releases[0],
      releases,
      rating: computeRatingSummary(allReviews),
      reviews: allReviews.slice(0, 20),
    },
  });
}

