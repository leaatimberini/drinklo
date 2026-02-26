import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { loadLearnerAcademyState } from "../../../lib/academy";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const instanceId = String(sp.get("instanceId") ?? "").trim();
  const learnerKey = String(sp.get("learnerKey") ?? "").trim();
  if (!instanceId || !learnerKey) {
    return NextResponse.json({ error: "instanceId and learnerKey are required" }, { status: 400 });
  }
  const blockedSteps = sp.getAll("blockedStep").map((v) => String(v));
  const payload = await loadLearnerAcademyState(prisma as any, {
    instanceId,
    learnerKey,
    locale: sp.get("locale"),
    icp: sp.get("icp"),
    companyId: sp.get("companyId"),
    onboardingBlockedSteps: blockedSteps,
  });
  return NextResponse.json(payload);
}

