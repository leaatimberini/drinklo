import crypto from "node:crypto";
import type { PrismaClient, LegalDocumentType } from "./generated/prisma";
import { buildSingleFileZip, hashEvidencePayload, stableStringify } from "./compliance-evidence";

type AnyPrisma = PrismaClient | Record<string, any>;

export const SIGNUP_REQUIRED_DOC_TYPES = ["TOS", "PRIVACY"] as const;
export type SignupRequiredDocType = (typeof SIGNUP_REQUIRED_DOC_TYPES)[number];

type SignupAcceptanceInput = {
  acceptTos?: boolean;
  acceptPrivacy?: boolean;
  locale?: string | null;
};

type AcceptanceContext = {
  installationId?: string | null;
  billingAccountId?: string | null;
  companyId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  source?: string;
  actor?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEFAULT_DOCS: Array<{
  type: LegalDocumentType;
  locale: "es" | "en";
  version: string;
  title: string;
  content: string;
}> = [
  {
    type: "TOS",
    locale: "es",
    version: "v1.0.0",
    title: "Términos del Servicio",
    content:
      "Aceptás los términos de uso de la plataforma, el período de trial de 30 días, grace y modo restricted sin borrado automático de datos.",
  },
  {
    type: "PRIVACY",
    locale: "es",
    version: "v1.0.0",
    title: "Política de Privacidad",
    content:
      "Aceptás el tratamiento de datos según la política de privacidad. El consentimiento de marketing se captura por separado.",
  },
  {
    type: "DPA",
    locale: "es",
    version: "v1.0.0",
    title: "Anexo de Procesamiento de Datos (DPA)",
    content: "Documento DPA para clientes enterprise. Define roles, medidas técnicas y subprocesadores.",
  },
  {
    type: "SLA",
    locale: "es",
    version: "v1.0.0",
    title: "Acuerdo de Nivel de Servicio (SLA)",
    content: "Documento SLA para clientes enterprise con objetivos, exclusiones y soporte por plan.",
  },
  {
    type: "TOS",
    locale: "en",
    version: "v1.0.0",
    title: "Terms of Service",
    content:
      "You accept the service terms, 30-day trial period, grace and restricted mode policy with no automatic data deletion.",
  },
  {
    type: "PRIVACY",
    locale: "en",
    version: "v1.0.0",
    title: "Privacy Policy",
    content:
      "You accept the privacy policy for data processing. Marketing consent is collected separately from trial signup.",
  },
  {
    type: "DPA",
    locale: "en",
    version: "v1.0.0",
    title: "Data Processing Addendum (DPA)",
    content: "Enterprise DPA covering controller/processor roles, technical safeguards and subprocessors.",
  },
  {
    type: "SLA",
    locale: "en",
    version: "v1.0.0",
    title: "Service Level Agreement (SLA)",
    content: "Enterprise SLA covering targets, exclusions and support terms.",
  },
];

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashPersonalSignal(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return hashText(raw);
}

export function normalizeLegalLocale(input: string | null | undefined) {
  const locale = String(input ?? "es").trim().toLowerCase();
  return locale.startsWith("en") ? "en" : "es";
}

export async function ensureDefaultLegalDocuments(prisma: AnyPrisma) {
  for (const doc of DEFAULT_DOCS) {
    await prisma.legalDocument.upsert({
      where: {
        type_version_locale: {
          type: doc.type,
          version: doc.version,
          locale: doc.locale,
        },
      },
      create: {
        ...doc,
        effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
        contentHash: hashText(doc.content),
        createdBy: "system:seed",
      },
      update: {
        title: doc.title,
        content: doc.content,
        contentHash: hashText(doc.content),
      },
    });
  }
}

export async function getLatestLegalDocuments(
  prisma: AnyPrisma,
  input: { types: readonly LegalDocumentType[]; locale?: string | null; now?: Date },
) {
  const locale = normalizeLegalLocale(input.locale);
  const now = input.now ?? new Date();
  await ensureDefaultLegalDocuments(prisma);

  const rows = await prisma.legalDocument.findMany({
    where: {
      type: { in: [...input.types] },
      locale,
      effectiveAt: { lte: now },
    },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const byType = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!byType.has(row.type)) byType.set(row.type, row);
  }

  if (byType.size !== input.types.length && locale !== "es") {
    const fallback = await prisma.legalDocument.findMany({
      where: {
        type: { in: [...input.types] },
        locale: "es",
        effectiveAt: { lte: now },
      },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    for (const row of fallback) {
      if (!byType.has(row.type)) byType.set(row.type, row);
    }
  }

  return byType;
}

export async function validateSignupClickwrap(
  prisma: AnyPrisma,
  input: SignupAcceptanceInput,
  now = new Date(),
) {
  const acceptedTos = input.acceptTos === true;
  const acceptedPrivacy = input.acceptPrivacy === true;
  if (!acceptedTos || !acceptedPrivacy) {
    throw new Error("legal_acceptance_required");
  }

  const docs = await getLatestLegalDocuments(prisma, {
    types: SIGNUP_REQUIRED_DOC_TYPES,
    locale: input.locale,
    now,
  });

  for (const type of SIGNUP_REQUIRED_DOC_TYPES) {
    if (!docs.has(type)) throw new Error(`legal_document_missing_${type.toLowerCase()}`);
  }

  return {
    locale: normalizeLegalLocale(input.locale),
    documents: SIGNUP_REQUIRED_DOC_TYPES.map((type) => docs.get(type)!),
  };
}

export async function recordLegalAcceptances(
  prisma: AnyPrisma,
  input: {
    documents: Array<{
      id: string;
      type: LegalDocumentType;
      version: string;
      locale: string;
      contentHash?: string | null;
    }>;
  } & AcceptanceContext,
) {
  const acceptedAt = new Date();
  const ipHash = hashPersonalSignal(input.ip);
  const userAgentHash = hashPersonalSignal(input.userAgent);
  const source = input.source ?? "clickwrap";
  const metadata = input.metadata ?? null;

  const created = [] as Array<{ id: string; docType: LegalDocumentType; version: string }>;
  for (const doc of input.documents) {
    const evidencePayload = {
      kind: "legal_acceptance",
      installationId: input.installationId ?? null,
      billingAccountId: input.billingAccountId ?? null,
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      docType: doc.type,
      version: doc.version,
      locale: doc.locale,
      acceptedAt: acceptedAt.toISOString(),
      source,
    };
    const evidenceHash = hashEvidencePayload(evidencePayload);

    const row = await prisma.legalAcceptance.create({
      data: {
        installationId: input.installationId ?? null,
        billingAccountId: input.billingAccountId ?? null,
        companyId: input.companyId ?? null,
        userId: input.userId ?? null,
        documentId: doc.id ?? null,
        docType: doc.type,
        version: doc.version,
        locale: doc.locale,
        acceptedAt,
        ipHash,
        userAgentHash,
        source,
        evidenceHash,
        metadata: metadata as any,
      },
    });
    created.push({ id: row.id, docType: row.docType, version: row.version });
  }

  return {
    acceptedAt,
    count: created.length,
    items: created,
  };
}

export function isEnterprisePlanName(planName: string | null | undefined) {
  const name = String(planName ?? "").toUpperCase();
  return name === "C3" || name.includes("ENTERPRISE") || name.startsWith("C3 ");
}

function signPayload(payload: unknown) {
  const secret =
    process.env.LEGAL_CLICKWRAP_SIGNING_SECRET ??
    process.env.SOC2_EVIDENCE_SIGNING_SECRET ??
    process.env.CONTROL_PLANE_ADMIN_TOKEN ??
    "legal-clickwrap-dev-secret";
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

export async function buildLegalAcceptanceEvidencePack(
  prisma: AnyPrisma,
  input: { instanceId: string; actor?: string | null },
) {
  const installation = await prisma.installation.findUnique({
    where: { instanceId: input.instanceId },
    select: { id: true, instanceId: true, clientName: true, domain: true },
  });
  if (!installation) throw new Error("installation_not_found");

  const [account, acceptances] = await Promise.all([
    prisma.billingAccount.findUnique({
      where: { instanceId: input.instanceId },
      select: { id: true, instanceId: true, clientName: true, plan: { select: { name: true } } },
    }),
    prisma.legalAcceptance.findMany({
      where: {
        OR: [
          { installation: { instanceId: input.instanceId } },
          { billingAccount: { instanceId: input.instanceId } },
        ],
      },
      include: { document: true },
      orderBy: [{ acceptedAt: "asc" }, { createdAt: "asc" }],
      take: 1000,
    }),
  ]);

  const manifest = {
    kind: "legal_clickwrap_evidence_pack",
    generatedAt: new Date().toISOString(),
    installation,
    account: account
      ? {
          id: account.id,
          instanceId: account.instanceId,
          clientName: account.clientName,
          planName: account.plan?.name ?? null,
        }
      : null,
    acceptances: (acceptances as Array<Record<string, any>>).map((row) => ({
      id: row.id,
      docType: row.docType,
      version: row.version,
      locale: row.locale,
      acceptedAt: row.acceptedAt.toISOString(),
      userId: row.userId ?? null,
      companyId: row.companyId ?? null,
      source: row.source,
      evidenceHash: row.evidenceHash ?? null,
      document: row.document
        ? {
            id: row.document.id,
            title: row.document.title,
            version: row.document.version,
            type: row.document.type,
            locale: row.document.locale,
            effectiveAt: row.document.effectiveAt.toISOString(),
            contentHash: row.document.contentHash,
          }
        : null,
    })),
  };
  const payloadHash = hashEvidencePayload(manifest);
  const signature = signPayload({ payloadHash, instanceId: input.instanceId, generatedAt: manifest.generatedAt });
  const signed = {
    ...manifest,
    payloadHash,
    signature,
    signatureAlgorithm: "HMAC-SHA256",
  };
  const json = Buffer.from(`${JSON.stringify(signed, null, 2)}\n`, "utf8");
  const zip = buildSingleFileZip(`legal-clickwrap-${installation.instanceId}.json`, json);

  await prisma.complianceEvidence.create({
    data: {
      installationId: installation.id,
      controlId: null,
      evidenceType: "legal_clickwrap.acceptance_pack",
      source: "control-plane",
      payload: {
        instanceId: installation.instanceId,
        payloadHash,
        signature,
        acceptanceCount: acceptances.length,
      } as any,
      payloadHash,
      sourceCapturedAt: new Date(),
      capturedBy: input.actor ?? "legal-clickwrap",
      tags: ["legal", "clickwrap", "evidence"],
    },
  });

  return {
    filename: `legal-clickwrap-evidence-${installation.instanceId}-${manifest.generatedAt.slice(0, 10)}.zip`,
    zip,
    manifest: signed,
  };
}
