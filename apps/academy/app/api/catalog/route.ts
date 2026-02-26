import { NextRequest, NextResponse } from "next/server";
import { fallbackCatalog, proxyControlPlane } from "../../lib/control-plane";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const qs = req.nextUrl.search;
  try {
    const { res, payload } = await proxyControlPlane(`/api/academy/catalog${qs}`);
    return NextResponse.json(payload, { status: res.status });
  } catch {
    return NextResponse.json(fallbackCatalog(sp.get("locale") ?? "es"));
  }
}

