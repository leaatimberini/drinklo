import { NextRequest, NextResponse } from "next/server";
import { proxyControlPlane } from "../../lib/control-plane";

export async function GET(req: NextRequest) {
  const { res, payload } = await proxyControlPlane(`/api/academy/progress${req.nextUrl.search}`);
  return NextResponse.json(payload, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { res, payload } = await proxyControlPlane(`/api/academy/progress`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(payload, { status: res.status });
}

