import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getTokenForRole, isRoleAllowed, type Role } from "../../../lib/auth";
import { getPricingExperimentResults } from "../../../lib/pricing-experiments";

function getRole(req: NextRequest): Role | null {
  const header = req.headers.get("x-cp-admin-token");
  if (header && header === process.env.CONTROL_PLANE_ADMIN_TOKEN) return "admin";
  const role = req.cookies.get("cp_role")?.value as Role | undefined;
  const token = req.cookies.get("cp_token")?.value;
  if (!role || !token) return null;
  const expected = getTokenForRole(role);
  if (!expected || token !== expected) return null;
  return role;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (!role || !isRoleAllowed(role, ["support", "ops", "admin"])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(String(sp.get("from"))) : null;
  const to = sp.get("to") ? new Date(String(sp.get("to"))) : null;
  const payload = await getPricingExperimentResults(prisma as any, {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  });
  return NextResponse.json(payload);
}
