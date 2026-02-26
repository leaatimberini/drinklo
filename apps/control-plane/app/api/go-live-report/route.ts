import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { prisma } from "../../lib/prisma";
import { buildGoLiveReportPayload, generateAndStoreGoLiveReport } from "../../lib/go-live-report";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actorFromRequest(req: NextRequest) {
  const hasRole = Boolean(req.cookies.get("cp_role")?.value);
  const hasHeader = Boolean(req.headers.get("x-cp-admin-token"));
  return hasRole || hasHeader ? "control-plane-admin" : "system";
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const installationId = String(sp.get("installationId") ?? "").trim();
  const format = String(sp.get("format") ?? "pdf").toLowerCase();
  if (!installationId) {
    return NextResponse.json({ error: "installationId required" }, { status: 400 });
  }

  if (format === "json") {
    const payload = await buildGoLiveReportPayload(prisma as any, installationId);
    return NextResponse.json(payload);
  }

  try {
    const result = await generateAndStoreGoLiveReport(prisma as any, installationId, actorFromRequest(req));
    return new NextResponse(result.pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-GoLive-Report-Signature": result.signed.signature,
        "X-GoLive-Report-Manifest-Hash": result.signed.manifest.payloadHash,
        "X-GoLive-Report-Evidence-Id": result.evidence.id,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "go_live_report_generation_failed",
        message: String(error?.message ?? "unknown_error"),
      },
      { status: 500 },
    );
  }
}
