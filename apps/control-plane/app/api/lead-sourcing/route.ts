import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { getControlPlaneActor, getControlPlaneRoleFromRequest } from "../../lib/billing-bulk-ops";
import { prisma } from "../../lib/prisma";
import { applyLeadSourcingImport, parseAndEnrichLeadSourcingCsv } from "../../lib/lead-sourcing";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function canUseLeadSourcing(req: NextRequest) {
  if (isAdminRequest(req)) return true;
  const role = getControlPlaneRoleFromRequest(req);
  return role === "admin" || role === "support" || role === "ops";
}

function actorFromRequest(req: NextRequest) {
  return getControlPlaneActor(req) ?? req.cookies.get("cp_role")?.value ?? "control-plane-user";
}

async function readCsvFromForm(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new Error("file_required");
  }
  const csv = await file.text();
  return { form, csv, filename: file.name };
}

export async function GET(req: NextRequest) {
  if (!canUseLeadSourcing(req)) return unauthorized();
  const [imports, recentLeads, recentDeals] = await Promise.all([
    (prisma as any).complianceEvidence.findMany({
      where: { evidenceType: "lead_sourcing_import" },
      orderBy: { capturedAt: "desc" },
      take: 20,
      select: {
        id: true,
        capturedAt: true,
        capturedBy: true,
        payloadHash: true,
        payload: true,
        tags: true,
      },
    }),
    (prisma as any).crmLead.findMany({
      where: { source: "lead_sourcing_import" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        companyName: true,
        city: true,
        businessType: true,
        tags: true,
        updatedAt: true,
      },
    }),
    (prisma as any).crmDeal.findMany({
      where: { source: "lead_sourcing_import" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        stage: true,
        tags: true,
        updatedAt: true,
        lead: { select: { email: true, companyName: true } },
      },
    }),
  ]);

  return NextResponse.json({
    imports: imports.map((row: any) => ({
      id: row.id,
      capturedAt: row.capturedAt,
      capturedBy: row.capturedBy,
      payloadHash: row.payloadHash,
      tags: row.tags,
      summary: row.payload?.summary ?? null,
    })),
    recentLeads,
    recentDeals,
  });
}

export async function POST(req: NextRequest) {
  if (!canUseLeadSourcing(req)) return unauthorized();

  try {
    const { form, csv, filename } = await readCsvFromForm(req);
    const action = String(form.get("action") ?? "analyze").trim().toLowerCase();
    const parsed = parseAndEnrichLeadSourcingCsv(csv);

    if (action === "analyze") {
      return NextResponse.json({
        ok: true,
        action,
        filename,
        headers: parsed.headers,
        summary: parsed.summary,
        preview: parsed.enriched.slice(0, 50),
      });
    }

    if (action === "import") {
      const dryRun = String(form.get("dryRun") ?? "false").toLowerCase() === "true";
      const result = await applyLeadSourcingImport(prisma as any, {
        actor: actorFromRequest(req),
        rows: parsed.enriched,
        dryRun,
      });
      return NextResponse.json({
        ok: true,
        action,
        dryRun,
        filename,
        summary: result.summary,
        preview: result.preview.slice(0, 50),
      });
    }

    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error: any) {
    const code = String(error?.message ?? "lead_sourcing_error");
    const status = code === "file_required" ? 400 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}

