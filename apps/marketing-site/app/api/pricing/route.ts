import { NextResponse } from "next/server";
import { buildControlPlaneUrl } from "../../lib/marketing-site";

export const revalidate = 300;

export async function GET() {
  const url = buildControlPlaneUrl("/api/pricing-catalog/public");
  const res = await fetch(url, {
    next: { revalidate: 300 },
    headers: { "x-marketing-site": "1" },
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json({ error: "pricing_catalog_unavailable", tiers: [] }, { status: 502 });
  }
  const body = await res.json();
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

