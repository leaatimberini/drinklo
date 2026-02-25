import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "../../../../lib/prisma";
import { getTokenForRole, isRoleAllowed, type Role } from "../../../../lib/auth";

function isSupportRequest(req: NextRequest) {
  const role = req.cookies.get("cp_role")?.value as Role | undefined;
  const token = req.cookies.get("cp_token")?.value;
  if (!role || !token) return false;
  const expected = getTokenForRole(role);
  return token === expected && isRoleAllowed(role, ["support", "admin"]);
}

function stable(input: any): string {
  if (input === null || input === undefined) return "null";
  if (Array.isArray(input)) return `[${input.map(stable).join(",")}]`;
  if (typeof input !== "object") return JSON.stringify(input);
  const keys = Object.keys(input).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(input[k])}`).join(",")}}`;
}

function hashPayload(payload: any) {
  return crypto.createHash("sha256").update(stable(payload)).digest("hex");
}

export async function GET(req: NextRequest) {
  if (!isSupportRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [installations, audits] = await Promise.all([
    prisma.installation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, instanceId: true, domain: true, clientName: true, healthStatus: true },
    }),
    prisma.complianceEvidence.findMany({
      where: { evidenceType: "support.plan_change" },
      orderBy: { capturedAt: "desc" },
      take: 100,
      include: { installation: { select: { instanceId: true, domain: true, clientName: true } } },
    }),
  ]);
  return NextResponse.json({ installations, audits });
}

export async function POST(req: NextRequest) {
  if (!isSupportRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (req.cookies.get("cp_role")?.value as Role | undefined) ?? "support";
  const body = await req.json().catch(() => ({}));
  const instanceId = String(body.instanceId ?? "").trim();
  const action = String(body.action ?? "").trim().toUpperCase();
  const targetTier = body.targetTier ? String(body.targetTier).trim().toUpperCase() : null;
  const note = String(body.note ?? "").trim();
  if (!instanceId || !["UPGRADE", "DOWNGRADE", "CANCEL", "REACTIVATE"].includes(action)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({ where: { instanceId } });
  if (!installation) {
    return NextResponse.json({ error: "installation not found" }, { status: 404 });
  }

  const payload = {
    instanceId,
    installationId: installation.id,
    action,
    targetTier,
    note: note || null,
    requestedByRole: role,
    requestedAt: new Date().toISOString(),
    execution: "manual_or_agent_dispatch_pending",
  };
  const payloadHash = hashPayload(payload);

  const evidence = await prisma.complianceEvidence.create({
    data: {
      installationId: installation.id,
      evidenceType: "support.plan_change",
      source: "control-plane",
      payload: payload as any,
      payloadHash,
      sourceCapturedAt: new Date(),
      capturedBy: role,
      tags: ["billing", "plan-change", action.toLowerCase()],
    },
  });

  await prisma.alert.create({
    data: {
      installationId: installation.id,
      level: "info",
      message: `Support plan change scheduled: ${action}${targetTier ? ` -> ${targetTier}` : ""}`,
    },
  });

  return NextResponse.json({ ok: true, evidence, payload });
}
