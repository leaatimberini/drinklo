import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { computeRatingSummary } from "../../../lib/plugin-marketplace-public";

export async function GET() {
  const releases = await prisma.pluginRelease.findMany({
    where: { reviewStatus: "approved" },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    include: {
      publisher: { select: { id: true, name: true, verificationStatus: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        select: { rating: true },
      },
    },
    take: 500,
  });

  const latestByPlugin = new Map<string, (typeof releases)[number]>();
  for (const release of releases) {
    if (!latestByPlugin.has(release.name)) {
      latestByPlugin.set(release.name, release);
    }
  }

  const items = Array.from(latestByPlugin.values()).map((release) => ({
    id: release.id,
    name: release.name,
    version: release.version,
    channel: release.channel,
    compatibility: release.compatibility,
    compatibilityMatrix: (release as any).compatibilityMatrix ?? null,
    certified: release.certified,
    certifiedAt: release.certifiedAt,
    changelog: release.changelog,
    publisher: release.publisher,
    rating: computeRatingSummary(release.reviews),
    createdAt: release.createdAt,
  }));

  return NextResponse.json({ items });
}

