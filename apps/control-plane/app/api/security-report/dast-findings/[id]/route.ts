import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { updateDastFindingStatus } from "../../../../lib/dast-findings";

export async function PATCH(req: NextRequest, ctx: any) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "").toLowerCase();
  if (!["open", "triaged", "fixed"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const id = ctx?.params?.id as string;
  const updated = await updateDastFindingStatus(id, status as any, body.note ?? null);
  return NextResponse.json({ id: updated.id, status: updated.status, triagedAt: updated.triagedAt, fixedAt: updated.fixedAt });
}
