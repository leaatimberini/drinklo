import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { trackOutboundSequenceEventByToken } from "../../../../lib/outbound-sequences";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

export async function GET(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get("t") ?? "").trim();
  if (!token) {
    return new NextResponse(PIXEL_GIF, { status: 200, headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
  }

  try {
    await trackOutboundSequenceEventByToken(prisma as any, {
      token,
      kind: "open",
      ip: req.headers.get("x-forwarded-for") ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  } catch {
    // best effort tracking
  }

  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

