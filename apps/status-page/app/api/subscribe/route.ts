import { NextRequest, NextResponse } from "next/server";
import { buildControlPlaneUrl } from "../../lib/status-page";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(buildControlPlaneUrl("/api/status-page/public/subscribe"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "subscribe_unavailable" }, { status: 502 });
  const payload = await res.json().catch(() => ({ error: "invalid_response" }));
  return NextResponse.json(payload, { status: res.status });
}

