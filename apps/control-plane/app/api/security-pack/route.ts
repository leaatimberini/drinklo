import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { prisma } from "../../lib/prisma";
import { buildEnterpriseSecurityPackPayload, generateAndStoreEnterpriseSecurityPack } from "../../lib/enterprise-security-pack";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actorFromRequest(req: NextRequest) {
  const role = req.cookies.get("cp_role")?.value;
  return role || req.headers.get("x-cp-actor") || "control-plane-admin";
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const format = String(sp.get("format") ?? "zip").toLowerCase();
  const installationId = String(sp.get("installationId") ?? "").trim();

  if (format === "list") {
    const items = await (prisma as any).installation.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        instanceId: true,
        clientName: true,
        domain: true,
        version: true,
        healthStatus: true,
        lastHeartbeatAt: true,
      },
    });
    return NextResponse.json({ items });
  }

  if (!installationId) {
    return NextResponse.json({ error: "installationId_required" }, { status: 400 });
  }

  if (format === "json") {
    try {
      const payload = await buildEnterpriseSecurityPackPayload(prisma as any, installationId);
      return NextResponse.json(payload);
    } catch (error: any) {
      return NextResponse.json({ error: String(error?.message ?? "build_failed") }, { status: 400 });
    }
  }

  try {
    const result = await generateAndStoreEnterpriseSecurityPack(prisma as any, installationId, actorFromRequest(req));
    if (format === "pdf") {
      return new NextResponse(result.pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.filenames.pdf}"`,
          "X-Security-Pack-Signature": result.signed.signature,
          "X-Security-Pack-Manifest-Hash": result.signed.manifest.payloadHash,
          "X-Security-Pack-Evidence-Id": result.evidence.id,
        },
      });
    }
    return new NextResponse(result.zip, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filenames.zip}"`,
        "X-Security-Pack-Signature": result.signed.signature,
        "X-Security-Pack-Manifest-Hash": result.signed.manifest.payloadHash,
        "X-Security-Pack-Evidence-Id": result.evidence.id,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "security_pack_failed") }, { status: 500 });
  }
}

