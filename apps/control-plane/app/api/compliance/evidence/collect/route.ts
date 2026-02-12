import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { collectComplianceEvidence } from "../../../../lib/compliance-evidence";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const actor = body.actor ? String(body.actor) : "admin";
  const result = await collectComplianceEvidence(actor);
  return NextResponse.json(result);
}
