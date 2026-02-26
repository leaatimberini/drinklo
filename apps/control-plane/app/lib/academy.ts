import crypto from "node:crypto";
import { hashEvidencePayload, stableStringify } from "./compliance-evidence";

type AnyPrisma = any;

export type AcademyIcp = "kiosco" | "distribuidora" | "bar";
export type AcademyLocale = "es" | "en";

export type AcademyQuizQuestion = {
  id: string;
  prompt: Record<AcademyLocale, string>;
  options: string[];
  correctIndex: number;
};

export type AcademyModule = {
  key: string;
  title: Record<AcademyLocale, string>;
  description: Record<AcademyLocale, string>;
  durationMin: number;
  quiz?: {
    passPct: number;
    questions: AcademyQuizQuestion[];
  };
};

export type AcademyCourse = {
  key: string;
  icps: AcademyIcp[];
  title: Record<AcademyLocale, string>;
  summary: Record<AcademyLocale, string>;
  certificateType?: string;
  onboardingStepHints?: string[];
  modules: AcademyModule[];
};

export const ACADEMY_COURSES: AcademyCourse[] = [
  {
    key: "kiosco-fast-start",
    icps: ["kiosco"],
    title: { es: "Kiosco: arranque rápido", en: "Kiosk: quick start" },
    summary: {
      es: "Catálogo, cobro con Mercado Pago y primera venta en POS.",
      en: "Catalog, Mercado Pago setup and first POS sale.",
    },
    certificateType: "ADMIN_CERTIFIED",
    onboardingStepHints: ["import_catalog", "configure_mercadopago", "test_print_scanner", "create_first_sale_or_order"],
    modules: [
      {
        key: "catalogo-express",
        title: { es: "Importación de catálogo", en: "Catalog import" },
        description: { es: "Carga rápida de productos y variantes con barcodes.", en: "Quick load of products and barcode variants." },
        durationMin: 12,
      },
      {
        key: "cobros-mp",
        title: { es: "Cobros con Mercado Pago", en: "Mercado Pago payments" },
        description: { es: "Configurar credenciales, validar checkout y webhook.", en: "Configure credentials, validate checkout and webhook." },
        durationMin: 18,
        quiz: {
          passPct: 70,
          questions: [
            {
              id: "q1",
              prompt: {
                es: "¿Qué se debe validar después de cargar credenciales de Mercado Pago?",
                en: "What should be verified after adding Mercado Pago credentials?",
              },
              options: ["Webhook y cobro de prueba", "Solo logo", "Impresora"],
              correctIndex: 0,
            },
            {
              id: "q2",
              prompt: {
                es: "¿Cuál es la prioridad antes de salir a producción?",
                en: "What is the priority before going live?",
              },
              options: ["Hacer una venta/cobro de prueba end-to-end", "Cambiar theme", "Agregar plugins"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        key: "primera-venta-pos",
        title: { es: "Primera venta y caja", en: "First sale and POS" },
        description: { es: "Flujo POS, escáner e impresión de ticket.", en: "POS flow, scanner and receipt preview." },
        durationMin: 15,
      },
    ],
  },
  {
    key: "distribuidora-operaciones",
    icps: ["distribuidora"],
    title: { es: "Distribuidora: operaciones y mayorista", en: "Distributor: operations and wholesale" },
    summary: {
      es: "Listas mayoristas, reparto/Andreani y primera orden.",
      en: "Wholesale price lists, delivery/Andreani and first order.",
    },
    certificateType: "ADMIN_CERTIFIED",
    onboardingStepHints: [
      "import_catalog",
      "configure_wholesale_pricelists",
      "configure_shipping",
      "configure_mercadopago",
      "create_first_sale_or_order",
    ],
    modules: [
      {
        key: "listas-mayoristas",
        title: { es: "Listas y reglas mayoristas", en: "Wholesale price lists and rules" },
        description: { es: "Diseñar listas por cliente y márgenes base.", en: "Design customer price lists and margins." },
        durationMin: 20,
      },
      {
        key: "reparto-andreani",
        title: { es: "Reparto propio / Andreani", en: "Own delivery / Andreani" },
        description: { es: "Zonas, cotización y pruebas de envío.", en: "Zones, quoting and shipment testing." },
        durationMin: 16,
      },
      {
        key: "quiz-mayorista",
        title: { es: "Checklist operativo", en: "Operational checklist" },
        description: { es: "Validaciones previas a primer pedido real.", en: "Checks before first real order." },
        durationMin: 10,
        quiz: {
          passPct: 70,
          questions: [
            {
              id: "q1",
              prompt: { es: "¿Qué conviene configurar antes de vender mayorista?", en: "What should be configured before wholesale selling?" },
              options: ["Lista de precios y stock", "Solo theme", "Solo bot"],
              correctIndex: 0,
            },
          ],
        },
      },
    ],
  },
  {
    key: "bar-servicio-rapido",
    icps: ["bar"],
    title: { es: "Bar: servicio rápido y control", en: "Bar: fast service and control" },
    summary: { es: "POS, impresión y operación de barra.", en: "POS, printing and bar operation." },
    certificateType: "ADMIN_CERTIFIED",
    onboardingStepHints: ["import_catalog", "test_print_scanner", "create_first_sale_or_order"],
    modules: [
      {
        key: "pos-veloz",
        title: { es: "POS veloz", en: "Fast POS" },
        description: { es: "Atajos, búsqueda y flujo de caja.", en: "Shortcuts, search and cash workflow." },
        durationMin: 14,
      },
      {
        key: "impresion-comandera",
        title: { es: "Impresión comandera", en: "Kitchen/bar printer" },
        description: { es: "Preview y troubleshooting inicial.", en: "Preview and initial troubleshooting." },
        durationMin: 12,
      },
    ],
  },
];

export function normalizeLocale(input: unknown): AcademyLocale {
  const value = String(input ?? "es").toLowerCase();
  return value.startsWith("en") ? "en" : "es";
}

export function normalizeIcp(input: unknown): AcademyIcp {
  const value = String(input ?? "kiosco").trim().toLowerCase();
  if (value === "distribuidora" || value === "bar") return value;
  return "kiosco";
}

export function getAcademyCatalog(args?: { icp?: unknown; locale?: unknown }) {
  const locale = normalizeLocale(args?.locale);
  const icp = args?.icp == null ? null : normalizeIcp(args.icp);
  const courses = ACADEMY_COURSES.filter((course) => (icp ? course.icps.includes(icp) : true)).map((course) => ({
    key: course.key,
    icps: course.icps,
    title: course.title[locale],
    summary: course.summary[locale],
    certificateType: course.certificateType ?? null,
    onboardingStepHints: course.onboardingStepHints ?? [],
    modules: course.modules.map((mod) => ({
      key: mod.key,
      title: mod.title[locale],
      description: mod.description[locale],
      durationMin: mod.durationMin,
      quiz: mod.quiz
        ? {
            passPct: mod.quiz.passPct,
            questions: mod.quiz.questions.map((q) => ({
              id: q.id,
              prompt: q.prompt[locale],
              options: q.options,
            })),
          }
        : null,
    })),
  }));
  return { locale, icp, courses };
}

export function recommendAcademyCoursesFromOnboarding(args: {
  icp?: unknown;
  blockedStepKeys?: string[];
  locale?: unknown;
  limit?: number;
}) {
  const icp = normalizeIcp(args.icp);
  const blocked = new Set((args.blockedStepKeys ?? []).map((v) => String(v)));
  const locale = normalizeLocale(args.locale);
  const scored = ACADEMY_COURSES.filter((course) => course.icps.includes(icp) || course.icps.includes("kiosco"))
    .map((course) => {
      const matchCount = (course.onboardingStepHints ?? []).filter((step) => blocked.has(step)).length;
      return { course, matchCount };
    })
    .filter((row) => row.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || a.course.modules.length - b.course.modules.length)
    .slice(0, Math.max(1, Number(args.limit ?? 3)))
    .map(({ course, matchCount }) => ({
      courseKey: course.key,
      title: course.title[locale],
      summary: course.summary[locale],
      matchCount,
      matchedSteps: (course.onboardingStepHints ?? []).filter((s) => blocked.has(s)),
      modules: course.modules.length,
    }));
  return scored;
}

function signCertificatePayload(payload: unknown) {
  const secret = process.env.ACADEMY_CERT_SIGNING_SECRET ?? process.env.SOC2_EVIDENCE_SIGNING_SECRET ?? "academy-dev-secret";
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function computeProgress(course: AcademyCourse, completedModuleKeys: string[], quizScores: Record<string, { correct: number; total: number; pct: number }>) {
  const moduleKeySet = new Set(completedModuleKeys);
  const totalModules = course.modules.length;
  const completedModules = course.modules.filter((m) => moduleKeySet.has(m.key)).length;
  const requiredQuizModules = course.modules.filter((m) => m.quiz);
  const quizzesPassed = requiredQuizModules.filter((m) => {
    const score = quizScores[m.key];
    if (!score || !m.quiz) return false;
    return score.pct >= m.quiz.passPct;
  }).length;
  const allQuizzesPassed = quizzesPassed === requiredQuizModules.length;
  const modulesDone = completedModules === totalModules;
  const progressPct = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;
  const completed = modulesDone && allQuizzesPassed;
  return { totalModules, completedModules, requiredQuizzes: requiredQuizModules.length, quizzesPassed, allQuizzesPassed, progressPct, completed };
}

function sanitizeLearnerKey(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw || "anonymous";
}

export async function trackAcademyProgress(
  prisma: AnyPrisma,
  input: {
    instanceId: string;
    companyId?: string | null;
    installationId?: string | null;
    learnerKey: string;
    learnerUserId?: string | null;
    learnerEmail?: string | null;
    learnerName?: string | null;
    icp?: string | null;
    locale?: string | null;
    courseKey: string;
    action: "module_complete" | "quiz_submit";
    moduleKey: string;
    quizAnswers?: number[];
    source?: string | null;
  },
) {
  const instanceId = String(input.instanceId);
  const installation = input.installationId
    ? await prisma.installation.findUnique({ where: { id: String(input.installationId) } })
    : await prisma.installation.findUnique({ where: { instanceId } });
  if (!installation) throw new Error("installation_not_found");

  const course = ACADEMY_COURSES.find((c) => c.key === String(input.courseKey));
  if (!course) throw new Error("course_not_found");
  const module = course.modules.find((m) => m.key === String(input.moduleKey));
  if (!module) throw new Error("module_not_found");

  const learnerKey = sanitizeLearnerKey(input.learnerKey);
  const existing = await prisma.academyProgress.findUnique({
    where: { instanceId_learnerKey_courseKey: { instanceId, learnerKey, courseKey: course.key } },
  });

  const completedModuleKeys = Array.isArray(existing?.completedModuleKeys) ? [...existing.completedModuleKeys] : [];
  const quizScores = (existing?.quizScores && typeof existing.quizScores === "object" ? { ...(existing.quizScores as any) } : {}) as Record<
    string,
    { correct: number; total: number; pct: number; submittedAt: string }
  >;

  if (input.action === "module_complete") {
    if (!completedModuleKeys.includes(module.key)) completedModuleKeys.push(module.key);
  }

  if (input.action === "quiz_submit") {
    if (!module.quiz) throw new Error("module_quiz_not_configured");
    const answers = Array.isArray(input.quizAnswers) ? input.quizAnswers.map((a) => Number(a)) : [];
    let correct = 0;
    const total = module.quiz.questions.length;
    module.quiz.questions.forEach((q, idx) => {
      if (Number.isFinite(answers[idx]) && answers[idx] === q.correctIndex) correct += 1;
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    quizScores[module.key] = { correct, total, pct, submittedAt: nowIso() };
    if (pct >= module.quiz.passPct && !completedModuleKeys.includes(module.key)) {
      completedModuleKeys.push(module.key);
    }
  }

  const summary = computeProgress(course, completedModuleKeys, quizScores as any);
  const status = summary.completed ? (existing?.status === "CERTIFIED" ? "CERTIFIED" : "COMPLETED") : summary.progressPct > 0 ? "IN_PROGRESS" : "NOT_STARTED";
  const now = new Date();

  const row = await prisma.academyProgress.upsert({
    where: { instanceId_learnerKey_courseKey: { instanceId, learnerKey, courseKey: course.key } },
    create: {
      installationId: installation.id,
      instanceId,
      companyId: input.companyId ?? null,
      learnerKey,
      learnerUserId: input.learnerUserId ?? null,
      learnerEmail: input.learnerEmail ?? null,
      learnerName: input.learnerName ?? null,
      icp: input.icp ?? null,
      locale: normalizeLocale(input.locale),
      courseKey: course.key,
      courseTitle: course.title[normalizeLocale(input.locale)],
      completedModuleKeys,
      quizScores: quizScores as any,
      progressPct: summary.progressPct,
      status: status as any,
      startedAt: now,
      completedAt: summary.completed ? now : null,
      lastActivityAt: now,
      source: input.source ?? "academy",
      metadata: { lastAction: input.action, lastModuleKey: module.key },
    },
    update: {
      companyId: input.companyId ?? existing?.companyId ?? null,
      learnerUserId: input.learnerUserId ?? existing?.learnerUserId ?? null,
      learnerEmail: input.learnerEmail ?? existing?.learnerEmail ?? null,
      learnerName: input.learnerName ?? existing?.learnerName ?? null,
      icp: input.icp ?? existing?.icp ?? null,
      locale: normalizeLocale(input.locale),
      courseTitle: course.title[normalizeLocale(input.locale)],
      completedModuleKeys,
      quizScores: quizScores as any,
      progressPct: summary.progressPct,
      status: status as any,
      startedAt: existing?.startedAt ?? now,
      completedAt: summary.completed ? existing?.completedAt ?? now : null,
      lastActivityAt: now,
      source: input.source ?? existing?.source ?? "academy",
      metadata: { ...(typeof existing?.metadata === "object" && existing?.metadata ? (existing.metadata as any) : {}), lastAction: input.action, lastModuleKey: module.key },
    },
  });

  return {
    progress: row,
    summary,
    course: {
      key: course.key,
      title: course.title[normalizeLocale(input.locale)],
      modules: course.modules.map((m) => ({ key: m.key, title: m.title[normalizeLocale(input.locale)] })),
    },
  };
}

export async function issueAcademyCertificate(
  prisma: AnyPrisma,
  input: {
    instanceId: string;
    courseKey: string;
    learnerKey: string;
    actor?: string | null;
    locale?: string | null;
  },
) {
  const instanceId = String(input.instanceId);
  const learnerKey = sanitizeLearnerKey(input.learnerKey);
  const progress = await prisma.academyProgress.findUnique({
    where: { instanceId_learnerKey_courseKey: { instanceId, learnerKey, courseKey: String(input.courseKey) } },
  });
  if (!progress) throw new Error("progress_not_found");
  if (!(progress.status === "COMPLETED" || progress.status === "CERTIFIED")) throw new Error("course_not_completed");

  const now = new Date();
  const payload = {
    certificateType: "ADMIN_CERTIFIED",
    instanceId,
    companyId: progress.companyId ?? null,
    learnerKey,
    learnerName: progress.learnerName ?? null,
    learnerEmail: progress.learnerEmail ?? null,
    courseKey: progress.courseKey,
    courseTitle: progress.courseTitle,
    issuedAt: now.toISOString(),
    progressId: progress.id,
    progressPct: progress.progressPct,
  };
  const evidenceHash = hashEvidencePayload(payload);
  const evidenceSignature = signCertificatePayload({ ...payload, evidenceHash });

  const existing = await prisma.academyCertificate.findFirst({
    where: { instanceId, learnerKey, courseKey: progress.courseKey, certificateType: "ADMIN_CERTIFIED" },
    orderBy: { issuedAt: "desc" },
  });

  const cert = existing
    ? await prisma.academyCertificate.update({
        where: { id: existing.id },
        data: {
          progressId: progress.id,
          learnerUserId: progress.learnerUserId,
          learnerEmail: progress.learnerEmail,
          learnerName: progress.learnerName,
          courseTitle: progress.courseTitle,
          locale: normalizeLocale(input.locale ?? progress.locale),
          issuedAt: now,
          evidencePayload: payload as any,
          evidenceHash,
          evidenceSignature,
          createdBy: input.actor ?? null,
        },
      })
    : await prisma.academyCertificate.create({
        data: {
          installationId: progress.installationId,
          instanceId,
          companyId: progress.companyId,
          progressId: progress.id,
          learnerKey,
          learnerUserId: progress.learnerUserId,
          learnerEmail: progress.learnerEmail,
          learnerName: progress.learnerName,
          courseKey: progress.courseKey,
          courseTitle: progress.courseTitle,
          certificateType: "ADMIN_CERTIFIED",
          locale: normalizeLocale(input.locale ?? progress.locale),
          issuedAt: now,
          evidencePayload: payload as any,
          evidenceHash,
          evidenceSignature,
          createdBy: input.actor ?? null,
        },
      });

  await prisma.academyProgress.update({ where: { id: progress.id }, data: { status: "CERTIFIED", completedAt: progress.completedAt ?? now } });

  await prisma.complianceEvidence.create({
    data: {
      installationId: progress.installationId,
      evidenceType: "academy_certificate",
      source: "academy",
      payload: {
        ...payload,
        certificateId: cert.id,
        evidenceHash,
        evidenceSignature,
      } as any,
      payloadHash: hashEvidencePayload({ certificateId: cert.id, evidenceHash, evidenceSignature, payload }),
      sourceCapturedAt: now,
      capturedAt: now,
      capturedBy: input.actor ?? "academy:system",
      tags: ["academy", "certificate", "training"],
    },
  });

  return { certificate: cert, evidence: { evidenceHash, evidenceSignature, issuedAt: cert.issuedAt } };
}

export async function loadAcademyProgressDashboard(prisma: AnyPrisma, args?: { instanceId?: string | null; take?: number }) {
  const where = args?.instanceId ? { instanceId: String(args.instanceId) } : {};
  const progresses = await prisma.academyProgress.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: { installation: { select: { id: true, instanceId: true, clientName: true } }, certificates: { orderBy: { issuedAt: "desc" }, take: 1 } },
    take: Math.max(1, Math.min(500, Number(args?.take ?? 200))),
  });

  const byInstance = new Map<string, any>();
  for (const row of progresses) {
    const key = row.instanceId;
    const bucket = byInstance.get(key) ?? {
      installationId: row.installationId,
      instanceId: row.instanceId,
      clientName: row.installation?.clientName ?? null,
      learners: new Set<string>(),
      coursesStarted: 0,
      coursesCompleted: 0,
      certificatesIssued: 0,
      avgProgressPct: 0,
      _progressSum: 0,
      progressRows: [] as any[],
    };
    bucket.learners.add(row.learnerKey);
    bucket.coursesStarted += 1;
    if (row.status === "COMPLETED" || row.status === "CERTIFIED") bucket.coursesCompleted += 1;
    if (row.certificates?.length) bucket.certificatesIssued += 1;
    bucket._progressSum += Number(row.progressPct ?? 0);
    bucket.progressRows.push({
      courseKey: row.courseKey,
      courseTitle: row.courseTitle,
      learnerKey: row.learnerKey,
      learnerName: row.learnerName,
      progressPct: row.progressPct,
      status: row.status,
      lastActivityAt: row.lastActivityAt,
      certificateIssuedAt: row.certificates?.[0]?.issuedAt ?? null,
    });
    byInstance.set(key, bucket);
  }

  const instances = Array.from(byInstance.values()).map((row) => ({
    ...row,
    learners: row.learners.size,
    avgProgressPct: row.coursesStarted ? Math.round(row._progressSum / row.coursesStarted) : 0,
    progressRows: row.progressRows.slice(0, 10),
  }));

  return {
    summary: {
      instances: instances.length,
      progressRows: progresses.length,
      certificates: progresses.filter((p: any) => p.status === "CERTIFIED").length,
    },
    instances,
  };
}

export async function loadLearnerAcademyState(prisma: AnyPrisma, args: {
  instanceId: string;
  learnerKey: string;
  locale?: string | null;
  icp?: string | null;
  companyId?: string | null;
  onboardingBlockedSteps?: string[];
}) {
  const locale = normalizeLocale(args.locale);
  const icp = args.icp ? normalizeIcp(args.icp) : null;
  const catalog = getAcademyCatalog({ icp, locale });
  const progressRows = await prisma.academyProgress.findMany({
    where: { instanceId: String(args.instanceId), learnerKey: sanitizeLearnerKey(args.learnerKey) },
    include: { certificates: { orderBy: { issuedAt: "desc" }, take: 1 } },
  });
  const byCourse = new Map(progressRows.map((r: any) => [r.courseKey, r]));
  const recommendations = recommendAcademyCoursesFromOnboarding({
    icp: icp ?? "kiosco",
    locale,
    blockedStepKeys: args.onboardingBlockedSteps ?? [],
  });

  return {
    ...catalog,
    learnerKey: sanitizeLearnerKey(args.learnerKey),
    companyId: args.companyId ?? null,
    recommendations,
    courses: catalog.courses.map((course) => {
      const row: any = byCourse.get(course.key);
      return {
        ...course,
        progress: row
          ? {
              status: row.status,
              progressPct: row.progressPct,
              completedModuleKeys: row.completedModuleKeys ?? [],
              lastActivityAt: row.lastActivityAt,
              certificate: row.certificates?.[0]
                ? {
                    id: row.certificates[0].id,
                    issuedAt: row.certificates[0].issuedAt,
                    evidenceHash: row.certificates[0].evidenceHash,
                  }
                : null,
            }
          : null,
      };
    }),
  };
}

