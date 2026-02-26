import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { trackProductTourEvent } from "../../../lib/product-tours";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const event = await trackProductTourEvent(prisma as any, {
      instanceId: body.instanceId ? String(body.instanceId) : null,
      companyId: body.companyId ? String(body.companyId) : null,
      userId: body.userId ? String(body.userId) : null,
      role: body.role ? String(body.role) : null,
      icp: body.icp ? String(body.icp) : null,
      locale: body.locale ? String(body.locale) : null,
      surface: String(body.surface ?? "").toUpperCase() as "ADMIN" | "STOREFRONT",
      eventType: String(body.eventType ?? "").toUpperCase() as "STARTED" | "COMPLETED" | "ABANDONED",
      tourId: body.tourId ? String(body.tourId) : null,
      tourKey: body.tourKey ? String(body.tourKey) : null,
      sessionId: body.sessionId ? String(body.sessionId) : null,
      stepIndex: body.stepIndex == null ? null : Number(body.stepIndex),
      stepId: body.stepId ? String(body.stepId) : null,
      path: body.path ? String(body.path) : null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : null,
    });
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "track_failed" }, { status: 400 });
  }
}

