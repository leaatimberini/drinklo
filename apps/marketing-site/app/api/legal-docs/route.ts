import { NextRequest, NextResponse } from "next/server";
import { buildControlPlaneUrl } from "../../lib/marketing-site";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") ?? "es";
  const res = await fetch(buildControlPlaneUrl(`/api/legal-clickwrap/public/signup-docs?locale=${encodeURIComponent(locale)}`), {
    next: { revalidate: 300 },
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ error: "control_plane_unreachable", documents: [] }, { status: 502 });
  }

  const payload = await res.json().catch(() => ({ documents: [] }));
  return NextResponse.json(payload, { status: res.status });
}

