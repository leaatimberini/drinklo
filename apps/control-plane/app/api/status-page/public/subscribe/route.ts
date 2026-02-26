import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { subscribeStatusPage } from "../../../../lib/status-page";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const sub = await subscribeStatusPage(prisma as any, {
      email: body.email ?? null,
      webhookUrl: body.webhookUrl ?? null,
      metadata: {
        source: "status-page-public",
        ua: req.headers.get("user-agent") ?? null,
      },
    });
    return NextResponse.json({ ok: true, subscription: sub });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "subscribe_failed") }, { status: 400 });
  }
}

