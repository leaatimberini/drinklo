import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { getControlPlaneActor, getControlPlaneRoleFromRequest } from "../../lib/billing-bulk-ops";
import { prisma } from "../../lib/prisma";
import {
  exportProposalPdf,
  generateProposalExport,
  loadProposalBuilderDashboard,
  previewProposal,
  upsertProposalTemplate,
} from "../../lib/proposal-builder";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function canUse(req: NextRequest) {
  if (isAdminRequest(req)) return true;
  const role = getControlPlaneRoleFromRequest(req);
  return role === "admin" || role === "support" || role === "ops";
}

function actor(req: NextRequest) {
  return getControlPlaneActor(req) ?? req.cookies.get("cp_role")?.value ?? "control-plane-user";
}

export async function GET(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const proposalId = String(sp.get("proposalId") ?? "").trim();
  const format = String(sp.get("format") ?? "dashboard").toLowerCase();

  try {
    if (proposalId && format === "pdf") {
      const result = await exportProposalPdf(prisma as any, proposalId);
      return new NextResponse(result.pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "X-Proposal-Signature": result.signature,
          "X-Proposal-Manifest-Hash": result.manifestHash,
          "X-Proposal-PDF-Hash": result.pdfHash,
        },
      });
    }

    if (proposalId && format === "json") {
      const result = await exportProposalPdf(prisma as any, proposalId);
      return NextResponse.json({
        proposal: result.proposal,
        export: { pdfHash: result.pdfHash, signature: result.signature, manifestHash: result.manifestHash, filename: result.filename },
      });
    }

    const payload = await loadProposalBuilderDashboard(prisma as any, {
      installationId: sp.get("installationId"),
      take: Number(sp.get("take") ?? 50),
    });
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "proposal_builder_get_failed") }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  if (!canUse(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  try {
    if (action === "upsertTemplate") {
      const template = await upsertProposalTemplate(prisma as any, {
        template: body?.template ?? {},
        actor: actor(req),
      });
      return NextResponse.json({ ok: true, template });
    }

    if (action === "preview") {
      const result = await previewProposal(prisma as any, {
        installationId: body?.installationId ?? null,
        templateId: body?.templateId ?? null,
        templateKey: body?.templateKey ?? null,
        locale: body?.locale ?? null,
        planTier: body?.planTier ?? null,
        addonKeys: Array.isArray(body?.addonKeys) ? body.addonKeys : [],
        clientName: body?.clientName ?? null,
        variables: body?.variables ?? {},
        pricing: body?.pricing ?? {},
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "generate") {
      const result = await generateProposalExport(prisma as any, {
        installationId: body?.installationId ?? null,
        templateId: body?.templateId ?? null,
        templateKey: body?.templateKey ?? null,
        locale: body?.locale ?? null,
        planTier: body?.planTier ?? null,
        addonKeys: Array.isArray(body?.addonKeys) ? body.addonKeys : [],
        clientName: body?.clientName ?? null,
        variables: body?.variables ?? {},
        pricing: body?.pricing ?? {},
        actor: actor(req),
      });
      return NextResponse.json({
        ok: true,
        result: {
          proposalId: result.proposalId,
          filename: result.filename,
          pdfHash: result.pdfHash,
          evidenceId: result.evidenceId,
          signature: result.signed.signature,
          manifestHash: result.signed.manifest.payloadHash,
          links: {
            pdf: `/api/proposal-builder?proposalId=${result.proposalId}&format=pdf`,
            json: `/api/proposal-builder?proposalId=${result.proposalId}&format=json`,
          },
          preview: result.payload,
        },
      });
    }

    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message ?? "proposal_builder_post_failed") }, { status: 400 });
  }
}

