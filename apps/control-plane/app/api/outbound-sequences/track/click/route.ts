import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { trackOutboundSequenceEventByToken } from "../../../../lib/outbound-sequences";

export async function GET(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get("t") ?? "").trim();
  const fallbackUrl = String(req.nextUrl.searchParams.get("u") ?? "").trim() || "/";

  if (!token) {
    return NextResponse.redirect(new URL(fallbackUrl, req.nextUrl.origin), 302);
  }

  try {
    const tracked = await trackOutboundSequenceEventByToken(prisma as any, {
      token,
      kind: "click",
      url: fallbackUrl,
      ip: req.headers.get("x-forwarded-for") ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
    const redirectUrl = tracked.redirectUrl ?? fallbackUrl;
    return NextResponse.redirect(new URL(redirectUrl, req.nextUrl.origin), 302);
  } catch {
    return NextResponse.redirect(new URL(fallbackUrl, req.nextUrl.origin), 302);
  }
}
