import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { prisma } from "../../../lib/prisma";
import {
  buildLegalAcceptanceEvidencePack,
  ensureDefaultLegalDocuments,
  getLatestLegalDocuments,
  hashPersonalSignal,
  isEnterprisePlanName,
  normalizeLegalLocale,
  recordLegalAcceptances,
} from "../../../lib/legal-clickwrap";
import { hashEvidencePayload } from "../../../lib/compliance-evidence";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function actor(req: NextRequest) {
  return req.cookies.get("cp_role")?.value ? `cp:${req.cookies.get("cp_role")?.value}` : "cp:admin";
}

type AdminActionBody = {
  action?: string;
  instanceId?: string;
  userId?: string;
  locale?: string;
  dpa?: boolean;
  sla?: boolean;
  document?: {
    type?: "TOS" | "DPA" | "SLA" | "PRIVACY";
    version?: string;
    locale?: string;
    title?: string;
    content?: string;
    effectiveAt?: string;
  };
};

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const kind = String(searchParams.get("kind") ?? "documents");
  const locale = normalizeLegalLocale(searchParams.get("locale"));
  const instanceId = searchParams.get("instanceId");

  if (kind === "documents") {
    await ensureDefaultLegalDocuments(prisma as any);
    const rows = await prisma.legalDocument.findMany({
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    const latestSignupDocs = await getLatestLegalDocuments(prisma as any, {
      types: ["TOS", "PRIVACY"],
      locale,
    });
    return NextResponse.json({
      documents: rows,
      latestSignupDocs: ["TOS", "PRIVACY"].map((type) => latestSignupDocs.get(type as "TOS" | "PRIVACY")).filter(Boolean),
    });
  }

  if (kind === "acceptances") {
    if (!instanceId) return NextResponse.json({ error: "instanceId required" }, { status: 400 });
    const rows = await prisma.legalAcceptance.findMany({
      where: {
        OR: [
          { installation: { instanceId } },
          { billingAccount: { instanceId } },
        ],
      },
      include: { document: true, billingAccount: { select: { id: true, instanceId: true, plan: { select: { name: true } } } } },
      orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ acceptances: rows });
  }

  return NextResponse.json({ error: "unsupported_kind" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as AdminActionBody;
  const action = String(body.action ?? "").trim();
  const who = actor(req);

  try {
    if (action === "upsertDocument") {
      const doc = body.document ?? {};
      const type = String(doc.type ?? "").toUpperCase();
      const version = String(doc.version ?? "").trim();
      const locale = normalizeLegalLocale(doc.locale);
      const title = String(doc.title ?? "").trim();
      const content = String(doc.content ?? "").trim();
      if (!["TOS", "DPA", "SLA", "PRIVACY"].includes(type) || !version || !title || !content) {
        return NextResponse.json({ error: "invalid_document_payload" }, { status: 400 });
      }
      const effectiveAt = doc.effectiveAt ? new Date(doc.effectiveAt) : new Date();
      const contentHash = hashPersonalSignal(content) ?? hashEvidencePayload({ content });
      const row = await prisma.legalDocument.upsert({
        where: {
          type_version_locale: {
            type: type as "TOS" | "DPA" | "SLA" | "PRIVACY",
            version,
            locale,
          },
        },
        create: {
          type: type as "TOS" | "DPA" | "SLA" | "PRIVACY",
          version,
          locale,
          title,
          content,
          contentHash,
          effectiveAt,
          createdBy: who,
        },
        update: {
          title,
          content,
          contentHash,
          effectiveAt,
          createdBy: who,
        },
      });
      return NextResponse.json({ ok: true, document: row });
    }

    if (action === "acceptEnterprise") {
      const instanceId = String(body.instanceId ?? "").trim();
      const userId = String(body.userId ?? "").trim() || "enterprise-admin";
      if (!instanceId) return NextResponse.json({ error: "instanceId required" }, { status: 400 });
      if (!body.dpa && !body.sla) return NextResponse.json({ error: "dpa_or_sla_required" }, { status: 400 });

      const account = await prisma.billingAccount.findUnique({
        where: { instanceId },
        include: { installation: true, plan: true },
      });
      if (!account || !account.installation) return NextResponse.json({ error: "billing_account_not_found" }, { status: 404 });
      if (!isEnterprisePlanName(account.plan?.name)) {
        return NextResponse.json({ error: "enterprise_only" }, { status: 400 });
      }

      const docs = await getLatestLegalDocuments(prisma as any, {
        types: [body.dpa ? "DPA" : null, body.sla ? "SLA" : null].filter(Boolean) as Array<"DPA" | "SLA">,
        locale: body.locale ?? "es",
      });
      const selected = [body.dpa ? docs.get("DPA") : null, body.sla ? docs.get("SLA") : null].filter(Boolean);
      if (selected.length === 0) return NextResponse.json({ error: "legal_docs_not_found" }, { status: 404 });

      const recorded = await recordLegalAcceptances(prisma as any, {
        documents: selected.map((d) => ({
          id: d.id,
          type: d.type,
          version: d.version,
          locale: d.locale,
          contentHash: d.contentHash,
        })),
        installationId: account.installationId,
        billingAccountId: account.id,
        companyId: null,
        userId,
        ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
        userAgent: req.headers.get("user-agent"),
        source: "enterprise_admin_clickwrap",
        actor: who,
        metadata: { acceptedBy: who, instanceId },
      });

      return NextResponse.json({ ok: true, accepted: recorded });
    }

    if (action === "evidencePack") {
      const instanceId = String(body.instanceId ?? "").trim();
      if (!instanceId) return NextResponse.json({ error: "instanceId required" }, { status: 400 });
      const pack = await buildLegalAcceptanceEvidencePack(prisma as any, { instanceId, actor: who });
      return new NextResponse(pack.zip, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${pack.filename}"`,
          "X-Legal-Clickwrap-Signature": String(pack.manifest.signature),
        },
      });
    }

    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "legal_clickwrap_failed" }, { status: 400 });
  }
}
