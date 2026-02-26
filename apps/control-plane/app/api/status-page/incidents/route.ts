import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { prisma } from "../../../lib/prisma";
import {
  addStatusIncidentUpdate,
  closeStatusIncident,
  createStatusIncident,
  publishIncidentPostmortem,
  publishStatusIncident,
  updateStatusIncident,
} from "../../../lib/status-page";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actor(req: NextRequest) {
  return req.cookies.get("cp_role")?.value ? `cp:${req.cookies.get("cp_role")?.value}` : "cp:admin";
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const incidents = await prisma.statusPageIncident.findMany({
    include: { updates: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ isClosed: "asc" }, { startedAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ incidents });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();
  const who = actor(req);
  try {
    if (action === "create") {
      const incident = await createStatusIncident(prisma as any, {
        title: body.title,
        summary: body.summary,
        impact: body.impact,
        state: body.state,
        component: body.component ?? null,
        installationId: body.installationId ?? null,
        isPublic: body.isPublic === true,
        createdBy: who,
      });
      return NextResponse.json({ ok: true, incident });
    }
    if (action === "patch") {
      const incident = await updateStatusIncident(prisma as any, {
        incidentId: String(body.incidentId ?? ""),
        actor: who,
        patch: body.patch ?? {},
      });
      return NextResponse.json({ ok: true, incident });
    }
    if (action === "addUpdate") {
      const update = await addStatusIncidentUpdate(prisma as any, {
        incidentId: String(body.incidentId ?? ""),
        message: body.message,
        state: body.state ?? null,
        isPublic: body.isPublic,
        actor: who,
      });
      return NextResponse.json({ ok: true, update });
    }
    if (action === "publish") {
      const incident = await publishStatusIncident(prisma as any, { incidentId: String(body.incidentId ?? ""), actor: who });
      return NextResponse.json({ ok: true, incident });
    }
    if (action === "close") {
      const incident = await closeStatusIncident(prisma as any, {
        incidentId: String(body.incidentId ?? ""),
        actor: who,
        resolutionSummary: body.resolutionSummary ?? null,
      });
      return NextResponse.json({ ok: true, incident });
    }
    if (action === "publishPostmortem") {
      const incident = await publishIncidentPostmortem(prisma as any, { incidentId: String(body.incidentId ?? ""), actor: who });
      return NextResponse.json({ ok: true, incident });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "incident_action_failed") }, { status: 400 });
  }
}

