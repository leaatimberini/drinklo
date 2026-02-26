import crypto from "node:crypto";
import { hashEvidencePayload, stableStringify } from "./compliance-evidence";
import { loadActivationScoresDashboard } from "./activation-score";

type AnyPrisma = any;

export type CaseStudyDraftInput = {
  installation: {
    id: string;
    instanceId: string;
    clientName?: string | null;
    domain?: string | null;
    version?: string | null;
    releaseChannel?: string | null;
    healthStatus?: string | null;
  };
  billingAccount?: {
    id?: string | null;
    planName?: string | null;
    planTier?: string | null;
    provider?: string | null;
    monthlyOrders?: number | null;
    monthlyGmvArs?: number | null;
    trialEndsAt?: Date | string | null;
    createdAt?: Date | string | null;
    currentPeriodStart?: Date | string | null;
  } | null;
  activation?: {
    score: number;
    state: string;
    signals?: Array<{ key: string; detected: boolean; label?: string }>;
  } | null;
  nps?: {
    responses: number;
    nps: number | null;
    latestComment?: string | null;
    csatAvg?: number | null;
  } | null;
  usage?: {
    logins30d?: number;
    pos30d?: number;
    campaigns30d?: number;
    orders30d?: number;
  } | null;
  crm?: {
    dealId?: string | null;
    stage?: string | null;
    notes?: string[];
    businessType?: string | null;
    ownerUserId?: string | null;
  } | null;
};

export type GeneratedCaseStudyDraft = {
  title: string;
  summary: string;
  icp: string;
  tags: string[];
  stack: string[];
  timeframeDays: number | null;
  metrics: {
    before: Array<{ key: string; label: string; value: string | number }>;
    after: Array<{ key: string; label: string; value: string | number }>;
    highlights: Array<{ key: string; label: string; value: string | number }>;
  };
  content: {
    context: string;
    problem: string;
    solution: string;
    metricsBeforeAfter: string;
    stack: string;
    timing: string;
    sources: {
      activationScore: number | null;
      nps: number | null;
      usageSignals: string[];
      crmNotesUsed: number;
    };
  };
};

function slugify(input: string) {
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "n/d";
  return new Intl.NumberFormat("es-AR").format(Number(value));
}

function computeNpsScore(scores: number[]) {
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters / scores.length) - (detractors / scores.length)) * 100);
}

function signManifest(payload: unknown) {
  const secret = process.env.CASE_STUDIES_SIGNING_SECRET ?? process.env.SOC2_EVIDENCE_SIGNING_SECRET ?? "case-studies-dev-secret";
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

function inferIcp(input: CaseStudyDraftInput) {
  const bt = String(input.crm?.businessType ?? "").toLowerCase();
  if (bt.includes("distrib")) return "distribuidora";
  if (bt.includes("bar")) return "bar";
  if (bt.includes("kiosco")) return "kiosco";
  const orders = Number(input.billingAccount?.monthlyOrders ?? input.usage?.orders30d ?? 0);
  const campaigns = Number(input.usage?.campaigns30d ?? 0);
  if (orders > 200 || campaigns > 0) return "distribuidora";
  return "kiosco";
}

function computeTimeframeDays(input: CaseStudyDraftInput) {
  const start = input.billingAccount?.createdAt ? new Date(input.billingAccount.createdAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const days = Math.round((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

export function generateCaseStudyDraftFromInput(input: CaseStudyDraftInput): GeneratedCaseStudyDraft {
  const clientName = input.installation.clientName?.trim() || input.installation.domain || input.installation.instanceId;
  const icp = inferIcp(input);
  const activationScore = input.activation?.score ?? null;
  const activationState = input.activation?.state ?? "UNKNOWN";
  const orders = Number(input.billingAccount?.monthlyOrders ?? input.usage?.orders30d ?? 0);
  const gmv = Number(input.billingAccount?.monthlyGmvArs ?? 0);
  const logins = Number(input.usage?.logins30d ?? 0);
  const posUsage = Number(input.usage?.pos30d ?? 0);
  const campaigns = Number(input.usage?.campaigns30d ?? 0);
  const nps = input.nps?.nps ?? null;
  const csat = input.nps?.csatAvg ?? null;
  const crmNotes = (input.crm?.notes ?? []).filter(Boolean).slice(0, 5);
  const firstNote = crmNotes[0] ?? "";
  const planName = input.billingAccount?.planName ?? input.billingAccount?.planTier ?? "C1";
  const stack = ["Control-plane", "Activation Score", "Billing", "CRM", "NPS/CSAT"].concat(
    input.billingAccount?.provider ? [String(input.billingAccount.provider)] : [],
  );
  const timeframeDays = computeTimeframeDays(input);

  const before = [
    { key: "activation_score", label: "Activation Score (antes)", value: 0 },
    { key: "orders", label: "Órdenes/mes (antes)", value: 0 },
    { key: "payment_method", label: "Pago conectado (antes)", value: "No" },
  ];
  const after = [
    { key: "activation_score", label: "Activation Score (actual)", value: activationScore ?? "n/d" },
    { key: "orders", label: "Órdenes/mes (actual)", value: orders },
    { key: "gmv", label: "GMV mensual ARS", value: gmv > 0 ? Math.round(gmv) : "n/d" },
  ];
  const highlights = [
    { key: "nps", label: "NPS", value: nps ?? "n/d" },
    { key: "csat", label: "CSAT promedio", value: csat ?? "n/d" },
    { key: "logins", label: "Logins 30d", value: logins || "n/d" },
    { key: "pos", label: "Uso POS 30d", value: posUsage || "n/d" },
    { key: "campaigns", label: "Campañas 30d", value: campaigns || "n/d" },
  ];

  const activationDetected = (input.activation?.signals ?? [])
    .filter((s) => s.detected)
    .map((s) => s.label || s.key)
    .slice(0, 5);

  const title = `${clientName}: de trial a operación ${icp === "distribuidora" ? "mayorista" : "retail"} con ${planName}`;
  const summary = `Caso generado automáticamente a partir de activación, uso, NPS y CRM. Requiere revisión y aprobación antes de publicar.`;

  const content = {
    context: `${clientName} (${icp}) inició implementación en la plataforma de bebidas con foco en puesta en marcha operativa y cobro digital.`,
    problem:
      firstNote ||
      `El equipo necesitaba acelerar onboarding, activar catálogo/cobros y llegar a primeras ventas con visibilidad de uso y soporte comercial.`,
    solution: `Se trabajó con checklist de onboarding, activación guiada, configuración de pagos/integraciones y seguimiento comercial desde CRM. El sistema consolidó señales de uso, feedback NPS/CSAT y métricas de activación para priorizar acciones.`,
    metricsBeforeAfter: `Activation Score: 0 -> ${activationScore ?? "n/d"} (${activationState}). Órdenes/mes: 0 -> ${orders}. GMV mensual estimado: ${gmv > 0 ? `ARS ${formatNumber(gmv)}` : "n/d"}. NPS: ${nps ?? "n/d"}${csat != null ? ` | CSAT: ${csat}` : ""}.`,
    stack: `Stack involucrado: ${Array.from(new Set(stack)).join(", ")}.`,
    timing:
      timeframeDays == null
        ? "Tiempo de implementación: n/d (falta fecha de inicio consolidada)."
        : `Tiempo observado desde alta de cuenta: ${timeframeDays} días.`,
    sources: {
      activationScore,
      nps,
      usageSignals: activationDetected,
      crmNotesUsed: crmNotes.length,
    },
  };

  return {
    title,
    summary,
    icp,
    tags: Array.from(new Set(["bebidas", icp, String(planName).toLowerCase(), "caso-de-exito"])),
    stack: Array.from(new Set(stack)),
    timeframeDays,
    metrics: { before, after, highlights },
    content,
  };
}

async function loadSourceSnapshot(prisma: AnyPrisma, installationId: string) {
  const installation = await prisma.installation.findUnique({
    where: { id: installationId },
    select: {
      id: true,
      instanceId: true,
      clientName: true,
      domain: true,
      version: true,
      releaseChannel: true,
      healthStatus: true,
      createdAt: true,
    },
  });
  if (!installation) throw new Error("installation_not_found");

  const [billingAccount, activationDash, feedback, featureUsage, crmDeal] = await Promise.all([
    prisma.billingAccount.findFirst({
      where: { installationId },
      orderBy: { updatedAt: "desc" },
      include: { plan: { select: { name: true, tier: true } } },
    }),
    loadActivationScoresDashboard(prisma, { take: 1, instanceId: installation.instanceId }),
    prisma.feedbackSurveyResponse.findMany({
      where: {
        send: { installationId },
      },
      include: {
        send: {
          select: { campaignId: true, icp: true, planName: true, createdAt: true },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
    prisma.featureUsageSample.findMany({
      where: { installationId },
      orderBy: { capturedAt: "desc" },
      take: 120,
    }),
    prisma.crmDeal.findFirst({
      where: { installationId },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 10 }, lead: true },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  const activation = activationDash.items?.find((it: any) => it.installationId === installationId) ?? activationDash.items?.[0] ?? null;
  const npsScores = feedback.filter((r: any) => r.surveyType === "NPS").map((r: any) => Number(r.score));
  const csatScores = feedback.filter((r: any) => r.surveyType === "CSAT").map((r: any) => Number(r.score));
  const usageAgg = (featureUsage as any[]).reduce(
    (acc, row) => {
      const feature = String(row.feature ?? "").toLowerCase();
      const count = Number(row.count ?? 0) || 0;
      if (feature === "auth" || feature === "admin") acc.logins30d += count;
      if (feature === "pos") acc.pos30d += count;
      if (feature === "campaigns" || feature === "email_templates") acc.campaigns30d += count;
      if (feature === "orders" || feature === "checkout") acc.orders30d += count;
      return acc;
    },
    { logins30d: 0, pos30d: 0, campaigns30d: 0, orders30d: 0 },
  );

  const sourceInput: CaseStudyDraftInput = {
    installation,
    billingAccount: billingAccount
      ? {
          id: billingAccount.id,
          planName: billingAccount.plan?.name ?? null,
          planTier: (billingAccount as any).plan?.tier ?? null,
          provider: billingAccount.provider,
          monthlyOrders: billingAccount.monthlyOrders,
          monthlyGmvArs: billingAccount.monthlyGmvArs,
          trialEndsAt: billingAccount.trialEndsAt,
          createdAt: billingAccount.createdAt,
          currentPeriodStart: billingAccount.currentPeriodStart,
        }
      : null,
    activation: activation
      ? {
          score: Number(activation.score ?? 0),
          state: String(activation.state ?? "UNKNOWN"),
          signals: Array.isArray(activation.signals)
            ? activation.signals.map((s: any) => ({ key: String(s.key), detected: Boolean(s.detected), label: s.label ? String(s.label) : undefined }))
            : [],
        }
      : null,
    nps: {
      responses: feedback.length,
      nps: computeNpsScore(npsScores),
      latestComment: feedback.find((r: any) => r.comment)?.comment ?? null,
      csatAvg: csatScores.length ? Math.round((csatScores.reduce((a: number, b: number) => a + b, 0) / csatScores.length) * 10) / 10 : null,
    },
    usage: usageAgg,
    crm: crmDeal
      ? {
          dealId: crmDeal.id,
          stage: crmDeal.stage,
          notes: (crmDeal.notes ?? []).map((n: any) => String(n.body ?? "")),
          businessType: crmDeal.lead?.businessType ?? null,
          ownerUserId: crmDeal.ownerUserId ?? null,
        }
      : null,
  };

  return { installation, billingAccount, crmDeal, sourceInput };
}

function pickCaseStudySlug(baseTitle: string, instanceId: string) {
  const base = slugify(baseTitle) || slugify(instanceId) || "case-study";
  return `${base}-${String(instanceId).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 12)}`;
}

async function writeEvidence(prisma: AnyPrisma, input: { installationId: string; actor: string; evidenceType: string; payload: any; tags?: string[] }) {
  const payloadHash = hashEvidencePayload(input.payload);
  const manifest = {
    installationId: input.installationId,
    evidenceType: input.evidenceType,
    payloadHash,
    capturedAt: new Date().toISOString(),
  };
  const signature = signManifest(manifest);
  return prisma.complianceEvidence.create({
    data: {
      installationId: input.installationId,
      evidenceType: input.evidenceType,
      source: "case_studies",
      payload: { ...input.payload, manifest, signature } as any,
      payloadHash,
      sourceCapturedAt: new Date(),
      capturedBy: input.actor,
      tags: input.tags ?? ["marketing", "case-study"],
    },
  });
}

export async function generateCaseStudyDraft(prisma: AnyPrisma, input: { installationId: string; actor: string; locale?: string }) {
  const loaded = await loadSourceSnapshot(prisma, input.installationId);
  const draft = generateCaseStudyDraftFromInput(loaded.sourceInput);
  const slug = pickCaseStudySlug(draft.title, loaded.installation.instanceId);
  const row = await prisma.caseStudy.create({
    data: {
      installationId: loaded.installation.id,
      instanceId: loaded.installation.instanceId,
      billingAccountId: loaded.billingAccount?.id ?? null,
      crmDealId: loaded.crmDeal?.id ?? null,
      slug,
      locale: (input.locale || "es").slice(0, 8),
      title: draft.title,
      summary: draft.summary,
      icp: draft.icp,
      tags: draft.tags,
      stack: draft.stack,
      timeframeDays: draft.timeframeDays,
      source: "auto-generator",
      status: "DRAFT",
      content: draft.content as any,
      metrics: draft.metrics as any,
      sourceSnapshot: loaded.sourceInput as any,
      createdBy: input.actor,
      updatedBy: input.actor,
    },
  });
  await writeEvidence(prisma, {
    installationId: loaded.installation.id,
    actor: input.actor,
    evidenceType: "case_study_draft_generated",
    payload: { caseStudyId: row.id, slug: row.slug, source: "auto-generator" },
  });
  return row;
}

export async function listCaseStudies(prisma: AnyPrisma, opts?: { status?: string; installationId?: string }) {
  return prisma.caseStudy.findMany({
    where: {
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.installationId ? { installationId: opts.installationId } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      installation: { select: { id: true, instanceId: true, clientName: true, domain: true } },
    },
    take: 200,
  });
}

export async function getCaseStudyById(prisma: AnyPrisma, id: string) {
  return prisma.caseStudy.findUnique({
    where: { id },
    include: { installation: { select: { id: true, instanceId: true, clientName: true, domain: true } } },
  });
}

export async function updateCaseStudyDraft(
  prisma: AnyPrisma,
  input: {
    id: string;
    actor: string;
    title?: string;
    summary?: string;
    content?: Record<string, any>;
    tags?: string[];
    stack?: string[];
    timeframeDays?: number | null;
    locale?: string;
  },
) {
  const existing = await prisma.caseStudy.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("case_study_not_found");
  if (existing.status === "PUBLISHED") throw new Error("cannot_edit_published_case_study");
  const nextTitle = input.title?.trim() || existing.title;
  return prisma.caseStudy.update({
    where: { id: input.id },
    data: {
      title: nextTitle,
      slug: existing.slug || pickCaseStudySlug(nextTitle, existing.instanceId),
      summary: input.summary?.trim() ?? undefined,
      content: input.content ? (input.content as any) : undefined,
      tags: input.tags ? input.tags.filter(Boolean) : undefined,
      stack: input.stack ? input.stack.filter(Boolean) : undefined,
      timeframeDays: input.timeframeDays === undefined ? undefined : input.timeframeDays,
      locale: input.locale ? input.locale.slice(0, 8) : undefined,
      updatedBy: input.actor,
    },
  });
}

export async function approveCaseStudy(prisma: AnyPrisma, input: { id: string; actor: string }) {
  const existing = await prisma.caseStudy.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("case_study_not_found");
  const updated = await prisma.caseStudy.update({
    where: { id: input.id },
    data: {
      status: existing.status === "PUBLISHED" ? "PUBLISHED" : "APPROVED",
      approvedAt: existing.approvedAt ?? new Date(),
      approvedBy: existing.approvedBy ?? input.actor,
      updatedBy: input.actor,
    },
  });
  await writeEvidence(prisma, {
    installationId: existing.installationId,
    actor: input.actor,
    evidenceType: "case_study_approved",
    payload: { caseStudyId: existing.id, status: updated.status, approvedAt: updated.approvedAt },
  });
  return updated;
}

export async function ensureCaseStudyPublishable(caseStudy: { id: string; status: string; approvalRequired?: boolean | null; approvedAt?: Date | null }) {
  if (caseStudy.approvalRequired !== false && !caseStudy.approvedAt) {
    throw new Error("approval_required");
  }
  if (caseStudy.status === "ARCHIVED") {
    throw new Error("cannot_publish_archived_case_study");
  }
}

export async function publishCaseStudy(prisma: AnyPrisma, input: { id: string; actor: string }) {
  const existing = await prisma.caseStudy.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("case_study_not_found");
  await ensureCaseStudyPublishable(existing);
  const updated = await prisma.caseStudy.update({
    where: { id: input.id },
    data: {
      status: "PUBLISHED",
      publishedAt: existing.publishedAt ?? new Date(),
      publishedBy: existing.publishedBy ?? input.actor,
      updatedBy: input.actor,
    },
  });
  await writeEvidence(prisma, {
    installationId: existing.installationId,
    actor: input.actor,
    evidenceType: "case_study_published",
    payload: { caseStudyId: existing.id, slug: existing.slug, publishedAt: updated.publishedAt },
  });
  return updated;
}

export async function listPublicCaseStudies(prisma: AnyPrisma) {
  return prisma.caseStudy.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      locale: true,
      title: true,
      summary: true,
      icp: true,
      tags: true,
      stack: true,
      timeframeDays: true,
      metrics: true,
      content: true,
      publishedAt: true,
      installation: { select: { clientName: true, domain: true } },
    },
    take: 100,
  });
}

export async function getPublicCaseStudyBySlug(prisma: AnyPrisma, slug: string) {
  return prisma.caseStudy.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      locale: true,
      title: true,
      summary: true,
      icp: true,
      tags: true,
      stack: true,
      timeframeDays: true,
      metrics: true,
      content: true,
      publishedAt: true,
      installation: { select: { clientName: true, domain: true, instanceId: true } },
    },
  });
}

