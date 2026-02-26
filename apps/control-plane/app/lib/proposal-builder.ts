import crypto from "node:crypto";
import { hashEvidencePayload, stableStringify } from "./compliance-evidence";

type AnyPrisma = any;

export type ProposalTemplateSection = {
  key: string;
  title: string;
  bodyTpl: string;
};

export type ProposalTemplateInput = {
  key: string;
  name: string;
  locale?: string;
  planTier?: string | null;
  addonKeys?: string[];
  status?: string;
  description?: string | null;
  sections: ProposalTemplateSection[];
  variablesSchema?: Record<string, any> | null;
  pricingDefaults?: Record<string, any> | null;
};

export type ProposalPricingInput = {
  currency?: string;
  baseAmount?: number;
  addonItems?: Array<{ key: string; label?: string; amount: number }>;
  discountPct?: number;
};

export type ProposalVariables = {
  clientName?: string;
  planTier?: string;
  addOns?: string[] | string;
  scope?: string;
  timeline?: string;
  costs?: string;
  exclusions?: string;
  [key: string]: unknown;
};

const DEFAULT_VARIABLES_SCHEMA = {
  required: ["scope", "timeline", "costs", "exclusions"],
  fields: {
    scope: { type: "string", label: "Alcance" },
    timeline: { type: "string", label: "Tiempos" },
    costs: { type: "string", label: "Costos / Supuestos" },
    exclusions: { type: "string", label: "Exclusiones" },
  },
};

export const DEFAULT_SOW_TEMPLATES: ProposalTemplateInput[] = [
  {
    key: "sow-c1-core-es",
    name: "SOW C1 Core (ES)",
    locale: "es",
    planTier: "C1",
    status: "ACTIVE",
    description: "Propuesta base para implementación C1.",
    sections: [
      { key: "contexto", title: "Contexto", bodyTpl: "Propuesta para {{clientName}} sobre plan {{planTier}}." },
      { key: "alcance", title: "Alcance", bodyTpl: "{{scope}}" },
      { key: "tiempos", title: "Tiempos", bodyTpl: "{{timeline}}" },
      { key: "costos", title: "Costos", bodyTpl: "{{costs}}\nTotal estimado: {{pricingTotal}} {{currency}}" },
      { key: "exclusiones", title: "Exclusiones", bodyTpl: "{{exclusions}}" },
    ],
    variablesSchema: DEFAULT_VARIABLES_SCHEMA,
    pricingDefaults: { currency: "USD", baseAmount: 499, addonItems: [] },
  },
  {
    key: "sow-c2-ops-es",
    name: "SOW C2 + Add-ons (ES)",
    locale: "es",
    planTier: "C2",
    addonKeys: ["andreani", "afip_arca", "marketplaces"],
    status: "ACTIVE",
    description: "Propuesta C2 con operaciones e integraciones.",
    sections: [
      { key: "contexto", title: "Objetivo", bodyTpl: "Implementación {{planTier}} para {{clientName}} con add-ons: {{addOns}}." },
      { key: "alcance", title: "Alcance incluido", bodyTpl: "{{scope}}" },
      { key: "entregables", title: "Entregables y tiempos", bodyTpl: "{{timeline}}" },
      { key: "costos", title: "Costos y condiciones", bodyTpl: "{{costs}}\nResumen: {{pricingBreakdown}}" },
      { key: "exclusiones", title: "Exclusiones y supuestos", bodyTpl: "{{exclusions}}" },
    ],
    variablesSchema: DEFAULT_VARIABLES_SCHEMA,
    pricingDefaults: {
      currency: "USD",
      baseAmount: 1490,
      addonItems: [
        { key: "andreani", label: "Andreani", amount: 250 },
        { key: "afip_arca", label: "ARCA readiness", amount: 300 },
      ],
    },
  },
];

function normalizeArray(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean)));
}

export function renderProposalTemplateText(text: string, vars: Record<string, unknown>) {
  return String(text ?? "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    if (Array.isArray(value)) return value.join(", ");
    return value == null ? "" : String(value);
  });
}

export function normalizeProposalTemplateInput(input: ProposalTemplateInput) {
  const key = String(input.key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) throw new Error("proposal_template_key_required");
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("proposal_template_name_required");
  const status = ["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(input.status ?? "DRAFT").toUpperCase())
    ? String(input.status ?? "DRAFT").toUpperCase()
    : "DRAFT";
  const locale = String(input.locale ?? "es").toLowerCase().startsWith("en") ? "en" : "es";
  const sections = (Array.isArray(input.sections) ? input.sections : [])
    .map((s, idx) => ({
      key: String(s.key ?? `section_${idx + 1}`).trim() || `section_${idx + 1}`,
      title: String(s.title ?? "").trim(),
      bodyTpl: String(s.bodyTpl ?? "").trim(),
    }))
    .filter((s) => s.title && s.bodyTpl);
  if (!sections.length) throw new Error("proposal_template_sections_required");

  return {
    key,
    name,
    locale,
    status,
    planTier: input.planTier ? String(input.planTier).toUpperCase() : null,
    addonKeys: normalizeArray(input.addonKeys).map((k) => k.toLowerCase()),
    description: input.description ? String(input.description) : null,
    sections,
    variablesSchema:
      input.variablesSchema && typeof input.variablesSchema === "object" && !Array.isArray(input.variablesSchema)
        ? input.variablesSchema
        : DEFAULT_VARIABLES_SCHEMA,
    pricingDefaults:
      input.pricingDefaults && typeof input.pricingDefaults === "object" && !Array.isArray(input.pricingDefaults)
        ? input.pricingDefaults
        : null,
  };
}

export function calculateProposalPricing(input?: ProposalPricingInput | null) {
  const currency = String(input?.currency ?? "USD").toUpperCase();
  const baseAmount = Math.max(0, Number(input?.baseAmount ?? 0));
  const addonSource: Array<{ key: string; label?: string; amount: number }> = Array.isArray(input?.addonItems) ? input.addonItems : [];
  const addonItems = addonSource.map((item) => ({
    key: String(item.key ?? "").trim().toLowerCase(),
    label: String(item.label ?? item.key ?? "").trim() || String(item.key ?? "addon"),
    amount: Math.max(0, Number(item.amount ?? 0)),
  }));
  const subtotal = baseAmount + addonItems.reduce((sum, item) => sum + item.amount, 0);
  const discountPct = Math.max(0, Math.min(100, Number(input?.discountPct ?? 0)));
  const discountAmount = Number(((subtotal * discountPct) / 100).toFixed(2));
  const total = Number((subtotal - discountAmount).toFixed(2));
  return { currency, baseAmount, addonItems, subtotal, discountPct, discountAmount, total };
}

function fmtMoney(value: number, currency: string) {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`;
}

export function buildProposalRenderedPayload(input: {
  template: any;
  variables: ProposalVariables;
  pricing: ReturnType<typeof calculateProposalPricing>;
  planTier: string;
  addonKeys: string[];
  clientName?: string | null;
}) {
  const mergedVars: Record<string, unknown> = {
    clientName: input.clientName ?? String(input.variables.clientName ?? "Cliente"),
    planTier: input.planTier,
    addOns: input.addonKeys,
    currency: input.pricing.currency,
    pricingBase: fmtMoney(input.pricing.baseAmount, input.pricing.currency),
    pricingSubtotal: fmtMoney(input.pricing.subtotal, input.pricing.currency),
    pricingDiscount: fmtMoney(input.pricing.discountAmount, input.pricing.currency),
    pricingTotal: fmtMoney(input.pricing.total, input.pricing.currency),
    pricingBreakdown:
      [
        `Base: ${fmtMoney(input.pricing.baseAmount, input.pricing.currency)}`,
        ...input.pricing.addonItems.map((a) => `${a.label}: ${fmtMoney(a.amount, input.pricing.currency)}`),
        `Subtotal: ${fmtMoney(input.pricing.subtotal, input.pricing.currency)}`,
        input.pricing.discountPct > 0 ? `Descuento ${input.pricing.discountPct}%: -${fmtMoney(input.pricing.discountAmount, input.pricing.currency)}` : null,
        `Total: ${fmtMoney(input.pricing.total, input.pricing.currency)}`,
      ]
        .filter(Boolean)
        .join(" | "),
    ...input.variables,
  };

  const sections = (input.template.sections ?? []).map((section: any) => ({
    key: String(section.key),
    title: String(section.title),
    body: renderProposalTemplateText(String(section.bodyTpl ?? ""), mergedVars),
  }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    locale: input.template.locale ?? "es",
    template: {
      id: input.template.id ?? null,
      key: input.template.key,
      name: input.template.name,
      planTier: input.template.planTier ?? null,
      addonKeys: input.template.addonKeys ?? [],
    },
    proposal: {
      clientName: mergedVars.clientName ?? null,
      planTier: input.planTier,
      addonKeys: input.addonKeys,
      variables: input.variables,
      pricing: input.pricing,
      sections,
    },
  };
}

function pickProposalSigningSecret() {
  return (
    process.env.PROPOSAL_BUILDER_SIGNING_SECRET ??
    process.env.SOC2_EVIDENCE_SIGNING_SECRET ??
    process.env.CONTROL_PLANE_ADMIN_TOKEN ??
    "proposal-builder-dev-secret"
  );
}

export function signProposalBundle(payload: any, opts?: { pdfHash?: string; secret?: string }) {
  const payloadHash = hashEvidencePayload(payload);
  const manifest = {
    version: 1,
    kind: "proposal_pdf",
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    templateKey: payload.template?.key ?? null,
    clientName: payload.proposal?.clientName ?? null,
    planTier: payload.proposal?.planTier ?? null,
    payloadHash,
    ...(opts?.pdfHash ? { pdfHash: opts.pdfHash } : {}),
  };
  const signature = crypto
    .createHmac("sha256", opts?.secret ?? pickProposalSigningSecret())
    .update(stableStringify(manifest))
    .digest("hex");
  return { manifest, signature, algorithm: "HMAC-SHA256" as const };
}

export function verifyProposalBundleSignature(bundle: { payload: any; manifest: any; signature: string }, secret?: string) {
  const signed = signProposalBundle(bundle.payload, { pdfHash: bundle.manifest?.pdfHash, secret });
  return signed.signature === bundle.signature;
}

function escapePdfText(value: string) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildSimplePdf(lines: string[]) {
  const width = 595;
  const height = 842;
  const fontSize = 10;
  const lineHeight = 13;
  const marginLeft = 36;
  let y = height - 42;
  const pageOps: string[] = ["BT", `/F1 ${fontSize} Tf`, "0 0 0 rg"];
  for (const raw of lines) {
    if (y < 40) break;
    pageOps.push(`${marginLeft} ${y} Td (${escapePdfText(raw.slice(0, 140))}) Tj`);
    y -= lineHeight;
  }
  pageOps.push("ET");
  const stream = Buffer.from(pageOps.join("\n"), "utf8");

  const objects: Buffer[] = [];
  const pushObj = (id: number, body: string | Buffer) => {
    const header = Buffer.from(`${id} 0 obj\n`, "utf8");
    const footer = Buffer.from(`\nendobj\n`, "utf8");
    const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
    objects[id] = Buffer.concat([header, bodyBuf, footer]);
  };

  pushObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObj(2, "<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  pushObj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`);
  pushObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObj(5, Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "utf8"), stream, Buffer.from("\nendstream", "utf8")]));

  let offset = 0;
  const chunks: Buffer[] = [];
  const offsets: number[] = [0];
  const header = Buffer.from("%PDF-1.4\n", "utf8");
  chunks.push(header);
  offset += header.length;
  for (let id = 1; id <= 5; id += 1) {
    offsets[id] = offset;
    chunks.push(objects[id]);
    offset += objects[id].length;
  }
  const xrefOffset = offset;
  const xrefLines = ["xref", `0 ${6}`, "0000000000 65535 f "];
  for (let id = 1; id <= 5; id += 1) xrefLines.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  const xref = Buffer.from(`${xrefLines.join("\n")}\n`, "utf8");
  chunks.push(xref);
  offset += xref.length;
  const trailer = Buffer.from(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "utf8");
  chunks.push(trailer);
  return Buffer.concat(chunks);
}

export function renderProposalPdf(input: { payload: any; manifest: any; signature: string }) {
  const p = input.payload;
  const pricing = p.proposal?.pricing ?? {};
  const lines = [
    "SOW / PROPOSAL",
    `Cliente: ${p.proposal?.clientName ?? "-"}`,
    `Plan: ${p.proposal?.planTier ?? "-"} | Add-ons: ${Array.isArray(p.proposal?.addonKeys) ? p.proposal.addonKeys.join(", ") : "-"}`,
    `Template: ${p.template?.name ?? p.template?.key ?? "-"}`,
    `Fecha: ${p.generatedAt ?? "-"}`,
    "",
    "RESUMEN DE COSTOS",
    `Moneda: ${pricing.currency ?? "-"}`,
    `Base: ${fmtMoney(Number(pricing.baseAmount ?? 0), String(pricing.currency ?? "USD"))}`,
    ...((Array.isArray(pricing.addonItems) ? pricing.addonItems : []) as any[]).map((a) => `Addon ${a.label ?? a.key}: ${fmtMoney(Number(a.amount ?? 0), String(pricing.currency ?? "USD"))}`),
    `Subtotal: ${fmtMoney(Number(pricing.subtotal ?? 0), String(pricing.currency ?? "USD"))}`,
    `Descuento: ${fmtMoney(Number(pricing.discountAmount ?? 0), String(pricing.currency ?? "USD"))}`,
    `Total: ${fmtMoney(Number(pricing.total ?? 0), String(pricing.currency ?? "USD"))}`,
    "",
    ...((p.proposal?.sections ?? []) as any[]).flatMap((s) => [`${String(s.title ?? "").toUpperCase()}`, ...String(s.body ?? "").split(/\r?\n/)]),
    "",
    "FIRMA",
    `Manifest hash: ${String(input.manifest?.payloadHash ?? "-")}`,
    `PDF hash: ${String(input.manifest?.pdfHash ?? "-")}`,
    `Signature: ${String(input.signature ?? "-")}`,
  ];
  return buildSimplePdf(lines);
}

export function hashBinarySha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function ensureDefaultTemplates(prisma: AnyPrisma, actor = "proposal-builder:seed") {
  for (const tpl of DEFAULT_SOW_TEMPLATES) {
    const normalized = normalizeProposalTemplateInput(tpl);
    await prisma.proposalTemplate.upsert({
      where: { key: normalized.key },
      create: {
        ...normalized,
        status: "ACTIVE",
        createdBy: actor,
        updatedBy: actor,
      },
      update: {
        name: normalized.name,
        locale: normalized.locale,
        planTier: normalized.planTier,
        addonKeys: normalized.addonKeys,
        description: normalized.description,
        sections: normalized.sections as any,
        variablesSchema: normalized.variablesSchema as any,
        pricingDefaults: normalized.pricingDefaults as any,
        updatedBy: actor,
      },
    });
  }
}

export async function upsertProposalTemplate(prisma: AnyPrisma, input: { template: ProposalTemplateInput; actor?: string | null }) {
  const actor = String(input.actor ?? "proposal-builder:admin");
  const tpl = normalizeProposalTemplateInput(input.template);
  return prisma.proposalTemplate.upsert({
    where: { key: tpl.key },
    create: { ...tpl, createdBy: actor, updatedBy: actor, sections: tpl.sections as any, variablesSchema: tpl.variablesSchema as any, pricingDefaults: tpl.pricingDefaults as any },
    update: { ...tpl, updatedBy: actor, sections: tpl.sections as any, variablesSchema: tpl.variablesSchema as any, pricingDefaults: tpl.pricingDefaults as any },
  });
}

async function resolveTemplate(prisma: AnyPrisma, input: {
  templateId?: string | null;
  templateKey?: string | null;
  planTier?: string | null;
  addonKeys?: string[];
  locale?: string | null;
}) {
  await ensureDefaultTemplates(prisma);
  if (input.templateId) {
    const found = await prisma.proposalTemplate.findUnique({ where: { id: String(input.templateId) } });
    if (found) return found;
  }
  if (input.templateKey) {
    const found = await prisma.proposalTemplate.findUnique({ where: { key: String(input.templateKey) } });
    if (found) return found;
  }
  const locale = String(input.locale ?? "es").toLowerCase().startsWith("en") ? "en" : "es";
  const tier = input.planTier ? String(input.planTier).toUpperCase() : null;
  const addonKeys = normalizeArray(input.addonKeys).map((k) => k.toLowerCase());
  const candidates = await prisma.proposalTemplate.findMany({
    where: { status: "ACTIVE", locale },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
  });
  const scored = (candidates as any[]).map((tpl) => {
    let score = 0;
    if (tier && String(tpl.planTier ?? "").toUpperCase() === tier) score += 10;
    if (!tier && !tpl.planTier) score += 3;
    const tplAddons = new Set((tpl.addonKeys ?? []).map((a: any) => String(a).toLowerCase()));
    for (const key of addonKeys) if (tplAddons.has(key)) score += 2;
    if (score === 0) score = 1;
    return { tpl, score };
  });
  scored.sort((a, b) => b.score - a.score || new Date(b.tpl.updatedAt).getTime() - new Date(a.tpl.updatedAt).getTime());
  return scored[0]?.tpl ?? null;
}

export async function previewProposal(prisma: AnyPrisma, input: {
  installationId?: string | null;
  templateId?: string | null;
  templateKey?: string | null;
  locale?: string | null;
  planTier?: string | null;
  addonKeys?: string[];
  clientName?: string | null;
  variables?: ProposalVariables | null;
  pricing?: ProposalPricingInput | null;
}) {
  const template = await resolveTemplate(prisma, input);
  if (!template) throw new Error("proposal_template_not_found");

  const installation =
    input.installationId
      ? await prisma.installation.findUnique({ where: { id: String(input.installationId) } })
      : null;
  const pricingDefaults = template.pricingDefaults && typeof template.pricingDefaults === "object" ? (template.pricingDefaults as any) : {};
  const pricing = calculateProposalPricing({
    currency: input.pricing?.currency ?? pricingDefaults.currency ?? "USD",
    baseAmount: input.pricing?.baseAmount ?? pricingDefaults.baseAmount ?? 0,
    addonItems: input.pricing?.addonItems ?? pricingDefaults.addonItems ?? [],
    discountPct: input.pricing?.discountPct ?? 0,
  });

  const planTier = String(input.planTier ?? template.planTier ?? "C1").toUpperCase();
  const addonKeys = normalizeArray(input.addonKeys).map((k) => k.toLowerCase());
  const payload = buildProposalRenderedPayload({
    template,
    variables: (input.variables ?? {}) as ProposalVariables,
    pricing,
    planTier,
    addonKeys,
    clientName: input.clientName ?? installation?.clientName ?? null,
  });
  const signed = signProposalBundle(payload);
  return { template, installation, payload, signed };
}

export async function generateProposalExport(prisma: AnyPrisma, input: {
  installationId?: string | null;
  templateId?: string | null;
  templateKey?: string | null;
  locale?: string | null;
  planTier?: string | null;
  addonKeys?: string[];
  clientName?: string | null;
  variables?: ProposalVariables | null;
  pricing?: ProposalPricingInput | null;
  actor?: string | null;
}) {
  const actor = String(input.actor ?? "proposal-builder:admin");
  const preview = await previewProposal(prisma, input);
  let signed = signProposalBundle(preview.payload);
  let pdf = renderProposalPdf({ payload: preview.payload, manifest: signed.manifest, signature: signed.signature });
  let pdfHash = hashBinarySha256(pdf);
  signed = signProposalBundle(preview.payload, { pdfHash });
  pdf = renderProposalPdf({ payload: preview.payload, manifest: signed.manifest, signature: signed.signature });
  pdfHash = hashBinarySha256(pdf);
  signed = signProposalBundle(preview.payload, { pdfHash });

  const proposal = await prisma.proposalDocument.create({
    data: {
      templateId: preview.template.id,
      installationId: preview.installation?.id ?? input.installationId ?? null,
      instanceId: preview.installation?.instanceId ?? null,
      clientName: preview.payload.proposal?.clientName ?? null,
      locale: preview.payload.locale ?? "es",
      planTier: preview.payload.proposal?.planTier ?? "C1",
      addonKeys: preview.payload.proposal?.addonKeys ?? [],
      status: "GENERATED",
      variables: (input.variables ?? {}) as any,
      pricingSummary: preview.payload.proposal?.pricing as any,
      renderedPayload: preview.payload as any,
      manifest: signed.manifest as any,
      signature: signed.signature,
      pdfHash,
      createdBy: actor,
    },
  });

  const evidencePayload = {
    kind: "proposal_builder.export",
    proposalId: proposal.id,
    templateKey: preview.template.key,
    installationId: preview.installation?.id ?? null,
    instanceId: preview.installation?.instanceId ?? null,
    clientName: preview.payload.proposal?.clientName ?? null,
    planTier: preview.payload.proposal?.planTier ?? null,
    addonKeys: preview.payload.proposal?.addonKeys ?? [],
    manifest: signed.manifest,
    signature: signed.signature,
    pdfHash,
  };
  const evidence = await prisma.complianceEvidence.create({
    data: {
      installationId: preview.installation?.id ?? null,
      evidenceType: "proposal_builder.export",
      source: "control-plane",
      payload: evidencePayload as any,
      payloadHash: hashEvidencePayload(evidencePayload),
      sourceCapturedAt: new Date(preview.payload.generatedAt),
      capturedBy: actor,
      tags: ["proposal", "sow", "pdf", "sales"],
    },
  });

  await prisma.proposalDocument.update({
    where: { id: proposal.id },
    data: { evidenceId: evidence.id },
  });

  return {
    proposalId: proposal.id,
    filename: `proposal-${preview.payload.proposal?.clientName ? String(preview.payload.proposal.clientName).replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "cliente"}-${proposal.id.slice(0, 8)}.pdf`,
    payload: preview.payload,
    signed,
    pdf,
    pdfHash,
    evidenceId: evidence.id,
  };
}

export async function exportProposalPdf(prisma: AnyPrisma, proposalId: string) {
  const proposal = await prisma.proposalDocument.findUnique({
    where: { id: String(proposalId) },
    include: { template: true, installation: true },
  });
  if (!proposal) throw new Error("proposal_not_found");
  const payload = proposal.renderedPayload;
  const manifest = proposal.manifest;
  const signature = proposal.signature;
  if (!payload || !manifest || !signature) throw new Error("proposal_not_exported");
  const pdf = renderProposalPdf({ payload, manifest, signature });
  const pdfHash = hashBinarySha256(pdf);
  return {
    proposal,
    pdf,
    pdfHash,
    filename: `proposal-${String(proposal.clientName ?? "cliente").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${proposal.id.slice(0, 8)}.pdf`,
    signature: String(signature),
    manifestHash: String((manifest as any)?.payloadHash ?? ""),
  };
}

export async function loadProposalBuilderDashboard(prisma: AnyPrisma, args?: { installationId?: string | null; take?: number }) {
  await ensureDefaultTemplates(prisma);
  const take = Math.min(200, Math.max(1, Number(args?.take ?? 50)));
  const installationId = String(args?.installationId ?? "").trim();
  const [templates, proposals] = await Promise.all([
    prisma.proposalTemplate.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    }),
    prisma.proposalDocument.findMany({
      where: installationId ? { installationId } : undefined,
      include: {
        template: { select: { key: true, name: true } },
        installation: { select: { id: true, instanceId: true, clientName: true, domain: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take,
    }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    templates,
    proposals,
    summary: {
      templatesActive: (templates as any[]).filter((t) => t.status === "ACTIVE").length,
      proposals: (proposals as any[]).length,
      accepted: (proposals as any[]).filter((p) => p.status === "ACCEPTED").length,
    },
  };
}
