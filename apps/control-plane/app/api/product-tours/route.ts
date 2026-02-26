import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { prisma } from "../../lib/prisma";
import { loadProductToursDashboard, upsertProductTour } from "../../lib/product-tours";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actor(req: NextRequest) {
  return req.cookies.get("cp_role")?.value ? `cp:${req.cookies.get("cp_role")?.value}` : "cp:admin";
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const take = Number(sp.get("take") ?? 300);
  const payload = await loadProductToursDashboard(prisma as any, { take });
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "upsert");
  try {
    if (action === "upsert") {
      const tour = await upsertProductTour(prisma as any, {
        ...body,
        tourId: body.tourId ?? null,
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, tour });
    }
    if (action === "archive") {
      const id = String(body.tourId ?? "");
      if (!id) return NextResponse.json({ error: "tourId required" }, { status: 400 });
      const row = await prisma.productTour.update({
        where: { id },
        data: { status: "ARCHIVED", updatedBy: actor(req) },
      });
      return NextResponse.json({ ok: true, tour: row });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "product_tours_failed" }, { status: 400 });
  }
}

