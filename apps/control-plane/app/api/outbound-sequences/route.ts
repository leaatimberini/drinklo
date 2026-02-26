import { NextRequest, NextResponse } from "next/server";
import { getControlPlaneActor, getControlPlaneRoleFromRequest } from "../../lib/billing-bulk-ops";
import { isAdminRequest } from "../../lib/admin-auth";
import { prisma } from "../../lib/prisma";
import {
  dispatchDueOutboundSequenceSteps,
  enrollOutboundSequenceByIcp,
  loadOutboundSequencesDashboard,
  normalizeOutboundSequenceInput,
  unsubscribeOutboundRecipient,
  upsertOutboundSequence,
} from "../../lib/outbound-sequences";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function canUse(req: NextRequest) {
  if (isAdminRequest(req)) return true;
  const role = getControlPlaneRoleFromRequest(req);
  return role === "admin" || role === "support";
}

function actor(req: NextRequest) {
  return getControlPlaneActor(req) ?? req.cookies.get("cp_role")?.value ?? "control-plane-user";
}

export async function GET(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const data = await loadOutboundSequencesDashboard(prisma as any);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  try {
    if (action === "upsertSequence") {
      const normalized = normalizeOutboundSequenceInput(body?.sequence ?? {});
      const sequence = await upsertOutboundSequence(prisma as any, {
        sequence: normalized as any,
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, sequence });
    }

    if (action === "enrollByIcp") {
      const result = await enrollOutboundSequenceByIcp(prisma as any, {
        sequenceId: String(body?.sequenceId ?? ""),
        icp: body?.icp ? String(body.icp) : null,
        limit: body?.limit == null ? undefined : Number(body.limit),
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "dispatchDue") {
      const result = await dispatchDueOutboundSequenceSteps(prisma as any, {
        actor: actor(req),
        limit: body?.limit == null ? undefined : Number(body.limit),
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "optOut") {
      const result = await unsubscribeOutboundRecipient(prisma as any, {
        email: String(body?.email ?? ""),
        source: "admin_manual",
        reason: body?.reason ? String(body.reason) : null,
      });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "outbound_sequences_error") }, { status: 400 });
  }
}

