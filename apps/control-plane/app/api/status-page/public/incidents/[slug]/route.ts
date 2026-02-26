import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const incident = await prisma.statusPageIncident.findFirst({
    where: { slug, isPublic: true },
    include: {
      updates: { where: { isPublic: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!incident) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(incident);
}

