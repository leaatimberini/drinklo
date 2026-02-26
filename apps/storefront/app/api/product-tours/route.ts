import { NextRequest, NextResponse } from "next/server";

function buildControlPlaneUrl(pathname: string) {
  const base = (process.env.CONTROL_PLANE_URL ?? process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010").replace(/\/+$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const upstream = new URL(buildControlPlaneUrl("/api/product-tours/public"));
  for (const [k, v] of url.searchParams.entries()) upstream.searchParams.set(k, v);
  if (!upstream.searchParams.get("surface")) upstream.searchParams.set("surface", "STOREFRONT");
  const res = await fetch(upstream.toString(), { next: { revalidate: 30 } }).catch(() => null);
  if (!res) return NextResponse.json({ error: "control_plane_unreachable" }, { status: 502 });
  const payload = await res.json().catch(() => ({}));
  return NextResponse.json(payload, { status: res.status });
}

