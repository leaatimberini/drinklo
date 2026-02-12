import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { listAccessibilityReports, normalizeAccessibilityPayload } from "../../../lib/accessibility";
import { prisma } from "../../../lib/prisma";

function isIngestAuthorized(req: NextRequest) {
  const expected = process.env.CONTROL_PLANE_INGEST_TOKEN ?? "";
  if (!expected) return false;
  const token = req.headers.get("x-cp-ingest-token") ?? "";
  return token === expected;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 100);
  const rows = await listAccessibilityReports(limit);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!isIngestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  let normalized;
  try {
    normalized = normalizeAccessibilityPayload(body);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "invalid payload" }, { status: 400 });
  }

  const installation = await prisma.installation.findUnique({
    where: { instanceId: normalized.instanceId },
    select: { id: true },
  });

  const report = await prisma.accessibilityReport.create({
    data: {
      installationId: installation?.id ?? null,
      instanceId: normalized.instanceId,
      version: normalized.version,
      score: normalized.score,
      criticalViolations: normalized.criticalViolations,
      seriousViolations: normalized.seriousViolations,
      totalViolations: normalized.totalViolations,
      pages: normalized.pages,
      measuredAt: normalized.measuredAt,
    },
  });

  return NextResponse.json({ ok: true, id: report.id });
}
