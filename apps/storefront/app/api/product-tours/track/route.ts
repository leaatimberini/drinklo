import { NextRequest, NextResponse } from "next/server";

function buildControlPlaneUrl(pathname: string) {
  const base = (process.env.CONTROL_PLANE_URL ?? process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010").replace(/\/+$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(buildControlPlaneUrl("/api/product-tours/track"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "control_plane_unreachable" }, { status: 502 });
  const payload = await res.json().catch(() => ({}));
  return NextResponse.json(payload, { status: res.status });
}

