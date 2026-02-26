import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { getControlPlaneActor, getControlPlaneRoleFromRequest } from "../../../lib/billing-bulk-ops";
import { prisma } from "../../../lib/prisma";
import { assertDemoResetAllowed, buildDemoResetEvidencePayload } from "../../../lib/demo-mode";

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

export async function POST(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const instanceId = String(body?.instanceId ?? "").trim();
  const adminToken = String(body?.adminToken ?? "").trim();
  const apiBaseUrlInput = String(body?.apiBaseUrl ?? "").trim();
  const confirmText = String(body?.confirmText ?? "").trim();

  if (!instanceId) return NextResponse.json({ error: "instanceId is required" }, { status: 400 });
  if (!adminToken) return NextResponse.json({ error: "adminToken is required" }, { status: 400 });

  const installation = await prisma.installation.findUnique({
    where: { instanceId },
    select: { id: true, instanceId: true, domain: true, clientName: true, releaseChannel: true },
  });

  try {
    assertDemoResetAllowed({ target: installation, confirmText });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "demo_reset_not_allowed") }, { status: 400 });
  }

  const fallbackBase = installation?.domain ? `https://${installation.domain}` : "";
  const apiBaseUrl = apiBaseUrlInput || fallbackBase;
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "apiBaseUrl required when installation has no domain" }, { status: 400 });
  }

  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/admin/sandbox/demo-reset`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));

  const evidence = buildDemoResetEvidencePayload({
    actor: actor(req),
    target: installation!,
    endpoint,
    responseStatus: response.status,
    responsePayload: payload,
  });
  await prisma.complianceEvidence.create({
    data: {
      installationId: installation?.id ?? null,
      evidenceType: "demo_mode.reset",
      source: "control-plane",
      payload: evidence.payload as any,
      payloadHash: evidence.payloadHash,
      sourceCapturedAt: new Date(),
      capturedBy: actor(req),
      tags: ["demo-mode", "reset", "operations"],
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "demo reset failed", endpoint, payload }, { status: 502 });
  }

  return NextResponse.json({ ok: true, endpoint, payload });
}

