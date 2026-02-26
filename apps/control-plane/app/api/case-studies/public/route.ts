import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getPublicCaseStudyBySlug, listPublicCaseStudies } from "../../../lib/case-studies";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const slug = String(req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (slug) {
    const item = await getPublicCaseStudyBySlug(prisma as any, slug);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ item }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  }

  const items = await listPublicCaseStudies(prisma as any);
  return NextResponse.json(
    {
      items,
      count: items.length,
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}

