import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { prisma } from "../../../lib/prisma";
import { approveCaseStudy, getCaseStudyById, publishCaseStudy, updateCaseStudyDraft } from "../../../lib/case-studies";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actorFromRequest(req: NextRequest) {
  return req.cookies.get("cp_role")?.value || req.headers.get("x-cp-actor") || "control-plane-admin";
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return unauthorized();
  const { id } = await context.params;
  const item = await getCaseStudyById(prisma as any, id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return unauthorized();
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    const item = await updateCaseStudyDraft(prisma as any, {
      id,
      actor: actorFromRequest(req),
      title: body?.title,
      summary: body?.summary,
      content: body?.content,
      tags: Array.isArray(body?.tags) ? body.tags : undefined,
      stack: Array.isArray(body?.stack) ? body.stack : undefined,
      timeframeDays: body?.timeframeDays == null ? undefined : Number(body.timeframeDays),
      locale: body?.locale,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "update_failed") }, { status: 400 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return unauthorized();
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  try {
    if (action === "approve") {
      const item = await approveCaseStudy(prisma as any, { id, actor: actorFromRequest(req) });
      return NextResponse.json({ ok: true, item });
    }
    if (action === "publish") {
      const item = await publishCaseStudy(prisma as any, { id, actor: actorFromRequest(req) });
      return NextResponse.json({ ok: true, item });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error: any) {
    const code = String(error?.message ?? "action_failed");
    const status = code === "approval_required" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}

