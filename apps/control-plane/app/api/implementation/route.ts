import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { getControlPlaneActor, getControlPlaneRoleFromRequest } from "../../lib/billing-bulk-ops";
import { prisma } from "../../lib/prisma";
import {
  loadImplementationDashboard,
  syncImplementationChecklistFromSignals,
  syncImplementationChecklistTemplate,
  updateImplementationChecklistItem,
  upsertImplementationProject,
} from "../../lib/implementation";
import { generateAndStoreGoLiveReport } from "../../lib/go-live-report";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function canUse(req: NextRequest) {
  if (isAdminRequest(req)) return true;
  const role = getControlPlaneRoleFromRequest(req);
  return role === "admin" || role === "ops" || role === "support";
}

function actor(req: NextRequest) {
  return getControlPlaneActor(req) ?? req.cookies.get("cp_role")?.value ?? "control-plane-user";
}

export async function GET(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const installationId = sp.get("installationId");
  const instanceId = sp.get("instanceId");
  try {
    const payload = await loadImplementationDashboard(prisma as any, {
      installationId: installationId ? String(installationId) : null,
      instanceId: instanceId ? String(instanceId) : null,
    });
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "implementation_load_failed") }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  try {
    if (action === "upsertProject") {
      const project = await upsertImplementationProject(prisma as any, {
        installationId: String(body?.installationId ?? ""),
        icp: body?.icp,
        ownerUserId: body?.ownerUserId ?? null,
        ownerName: body?.ownerName ?? null,
        kickoffAt: body?.kickoffAt ?? null,
        targetGoLiveAt: body?.targetGoLiveAt ?? null,
        status: body?.status ?? null,
        notes: body?.notes ?? null,
        seedChecklist: body?.seedChecklist !== false,
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, project });
    }

    if (action === "syncChecklistTemplate") {
      const project = await syncImplementationChecklistTemplate(prisma as any, {
        projectId: String(body?.projectId ?? ""),
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, project });
    }

    if (action === "syncSignals") {
      const result = await syncImplementationChecklistFromSignals(prisma as any, {
        installationId: String(body?.installationId ?? ""),
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "updateItem") {
      const item = await updateImplementationChecklistItem(prisma as any, {
        itemId: String(body?.itemId ?? ""),
        status: body?.status ?? null,
        responsibleRole: body?.responsibleRole ?? undefined,
        responsibleUserId: body?.responsibleUserId ?? undefined,
        responsibleName: body?.responsibleName ?? undefined,
        dueAt: body?.dueAt ?? undefined,
        notes: body?.notes ?? undefined,
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, item });
    }

    if (action === "generateFinalReport") {
      const installationId = String(body?.installationId ?? "");
      if (!installationId) return NextResponse.json({ error: "installationId required" }, { status: 400 });
      const report = await generateAndStoreGoLiveReport(prisma as any, installationId, actor(req));
      return NextResponse.json({
        ok: true,
        report: {
          filename: report.filename,
          pdfHash: report.pdfHash,
          evidenceId: report.evidence.id,
          signature: report.signed.signature,
          manifestHash: report.signed.manifest.payloadHash,
          links: {
            pdf: `/api/go-live-report?installationId=${installationId}&format=pdf`,
            json: `/api/go-live-report?installationId=${installationId}&format=json`,
          },
        },
      });
    }

    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "implementation_action_failed") }, { status: 400 });
  }
}

