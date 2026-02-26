import { NextResponse } from "next/server";
import { buildControlPlaneUrl } from "../../lib/status-page";

export async function GET() {
  const res = await fetch(buildControlPlaneUrl("/api/status-page/public/incidents"), {
    next: { revalidate: 30 },
  }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "incidents_unavailable" }, { status: 502 });
  return NextResponse.json(await res.json());
}

