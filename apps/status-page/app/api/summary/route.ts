import { NextResponse } from "next/server";
import { buildControlPlaneUrl } from "../../lib/status-page";

export async function GET() {
  const res = await fetch(buildControlPlaneUrl("/api/status-page/public/summary"), {
    next: { revalidate: 30 },
  }).catch(() => null);
  if (!res || !res.ok) {
    return NextResponse.json({ error: "summary_unavailable" }, { status: 502 });
  }
  return NextResponse.json(await res.json());
}

