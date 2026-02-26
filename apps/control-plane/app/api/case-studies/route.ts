import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { prisma } from "../../lib/prisma";
import { generateCaseStudyDraft, listCaseStudies } from "../../lib/case-studies";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actorFromRequest(req: NextRequest) {
  return req.cookies.get("cp_role")?.value || req.headers.get("x-cp-actor") || "control-plane-admin";
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const installationId = req.nextUrl.searchParams.get("installationId") || undefined;
  const items = await listCaseStudies(prisma as any, { status: status || undefined, installationId: installationId || undefined });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "generate");

  if (action === "generate") {
    const installationId = String(body?.installationId ?? "").trim();
    if (!installationId) return NextResponse.json({ error: "installationId_required" }, { status: 400 });
    try {
      const item = await generateCaseStudyDraft(prisma as any, {
        installationId,
        actor: actorFromRequest(req),
        locale: String(body?.locale ?? "es"),
      });
      return NextResponse.json({ ok: true, item });
    } catch (error: any) {
      return NextResponse.json({ error: String(error?.message ?? "generate_failed") }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
}

