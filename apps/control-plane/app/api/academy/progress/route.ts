import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { issueAcademyCertificate, loadLearnerAcademyState, trackAcademyProgress } from "../../../lib/academy";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const instanceId = String(sp.get("instanceId") ?? "").trim();
  const learnerKey = String(sp.get("learnerKey") ?? "").trim();
  if (!instanceId || !learnerKey) {
    return NextResponse.json({ error: "instanceId and learnerKey are required" }, { status: 400 });
  }
  const payload = await loadLearnerAcademyState(prisma as any, {
    instanceId,
    learnerKey,
    locale: sp.get("locale"),
    icp: sp.get("icp"),
    companyId: sp.get("companyId"),
    onboardingBlockedSteps: sp.getAll("blockedStep"),
  });
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();
  try {
    if (action === "module_complete" || action === "quiz_submit") {
      const result = await trackAcademyProgress(prisma as any, {
        instanceId: String(body.instanceId ?? ""),
        installationId: body.installationId ?? null,
        companyId: body.companyId ?? null,
        learnerKey: String(body.learnerKey ?? ""),
        learnerUserId: body.learnerUserId ?? null,
        learnerEmail: body.learnerEmail ?? null,
        learnerName: body.learnerName ?? null,
        icp: body.icp ?? null,
        locale: body.locale ?? null,
        courseKey: String(body.courseKey ?? ""),
        action,
        moduleKey: String(body.moduleKey ?? ""),
        quizAnswers: Array.isArray(body.quizAnswers) ? body.quizAnswers : undefined,
        source: body.source ?? "academy_ui",
      } as any);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "issue_certificate") {
      const result = await issueAcademyCertificate(prisma as any, {
        instanceId: String(body.instanceId ?? ""),
        courseKey: String(body.courseKey ?? ""),
        learnerKey: String(body.learnerKey ?? ""),
        actor: body.actor ?? "academy_ui",
        locale: body.locale ?? null,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "academy_progress_failed" },
      { status: 400 },
    );
  }
}

