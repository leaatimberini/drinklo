import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { listDastFindings } from "../../../lib/dast-findings";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 200);

  const rows = await listDastFindings({ status, severity, limit });
  return NextResponse.json(rows);
}
