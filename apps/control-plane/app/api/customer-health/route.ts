import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { loadCustomerHealthDashboard, runCustomerHealthAutomations } from "../../lib/customer-health";
import { prisma } from "../../lib/prisma";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actor(req: NextRequest) {
  return req.cookies.get("cp_role")?.value ? `cp:${req.cookies.get("cp_role")?.value}` : "cp:admin";
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const take = Number(sp.get("take") ?? 200);
  const instanceId = sp.get("instanceId");
  const payload = await loadCustomerHealthDashboard(prisma as any, { take, instanceId });
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();
  if (action !== "runAutomations") {
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  }
  const payload = await runCustomerHealthAutomations(prisma as any, {
    take: Number(body.take ?? 200),
    instanceId: body.instanceId ? String(body.instanceId) : null,
    actor: actor(req),
  });
  return NextResponse.json({ ok: true, ...payload });
}

