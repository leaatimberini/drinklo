import { hashEvidencePayload } from "./compliance-evidence";
import { loadActivationScoresDashboard } from "./activation-score";
import { loadAcademyProgressDashboard, recommendAcademyCoursesFromOnboarding } from "./academy";

type AnyPrisma = any;

export type ImplementationIcp = "kiosco" | "distribuidora" | "bar" | "enterprise";
export type ImplementationTaskStatus = "PENDING" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "WAIVED";
export type ReadinessColor = "RED" | "YELLOW" | "GREEN";

export type ImplementationTemplateTask = {
  taskKey: string;
  title: string;
  description?: string;
  phase: "setup" | "payments" | "operations" | "marketing" | "readiness";
  required: boolean;
  defaultResponsibleRole: string;
  dueOffsetDays: number;
  linkedSignalKey?: string;
  linkedCourseKey?: string;
  linkedTourKey?: string;
  onboardingStepHint?: string;
};

type ReadinessInput = {
  requiredTasks: Array<{ taskKey: string; status: ImplementationTaskStatus }>;
  activationScore?: number | null;
  activationState?: string | null;
  toursCompleted?: number;
  academyCertifiedCount?: number;
  backupsVerified30d?: number;
  drDrills30d?: number;
};

const BASE_TEMPLATE_TASKS: ImplementationTemplateTask[] = [
  {
    taskKey: "import_catalog",
    title: "Importar catálogo",
    description: "Cargar productos/variantes y validar búsqueda/barcodes.",
    phase: "setup",
    required: true,
    defaultResponsibleRole: "admin",
    dueOffsetDays: 2,
    linkedSignalKey: "catalog_imported",
    onboardingStepHint: "import_catalog",
  },
  {
    taskKey: "configure_mercadopago",
    title: "Configurar Mercado Pago",
    description: "Credenciales, webhook y cobro de prueba.",
    phase: "payments",
    required: true,
    defaultResponsibleRole: "admin",
    dueOffsetDays: 4,
    linkedSignalKey: "mercadopago_connected",
    onboardingStepHint: "configure_mercadopago",
  },
  {
    taskKey: "test_print_scanner",
    title: "Probar impresión/escáner",
    description: "POS + impresora + lectura barcode (preview/stub si aplica).",
    phase: "operations",
    required: false,
    defaultResponsibleRole: "ops",
    dueOffsetDays: 5,
    linkedSignalKey: "printing_ok",
    onboardingStepHint: "test_print_scanner",
    linkedTourKey: "admin-pos-first-steps",
  },
  {
    taskKey: "first_sale_or_order",
    title: "Crear primera venta/pedido",
    description: "Validar flujo end-to-end (venta POS u orden online).",
    phase: "operations",
    required: true,
    defaultResponsibleRole: "admin",
    dueOffsetDays: 7,
    linkedSignalKey: "first_sale",
    onboardingStepHint: "create_first_sale_or_order",
  },
  {
    taskKey: "academy_basics",
    title: "Completar curso base (Academy)",
    description: "Curso recomendado según ICP para reducir bloqueos de onboarding.",
    phase: "operations",
    required: false,
    defaultResponsibleRole: "admin",
    dueOffsetDays: 7,
    linkedCourseKey: "kiosco-fast-start",
  },
  {
    taskKey: "go_live_readiness_review",
    title: "Revisión final de go-live",
    description: "Checklist completo, riesgos y generación de reporte final firmado.",
    phase: "readiness",
    required: true,
    defaultResponsibleRole: "support",
    dueOffsetDays: 10,
  },
];

const ICP_OVERRIDES: Record<ImplementationIcp, ImplementationTemplateTask[]> = {
  kiosco: [],
  distribuidora: [
    {
      taskKey: "configure_wholesale_lists",
      title: "Configurar listas mayoristas",
      description: "Listas/reglas y precios para clientes mayoristas.",
      phase: "setup",
      required: true,
      defaultResponsibleRole: "admin",
      dueOffsetDays: 3,
      onboardingStepHint: "configure_wholesale_pricelists",
    },
    {
      taskKey: "configure_delivery",
      title: "Configurar reparto / Andreani",
      description: "Zonas, cotización y/o reparto propio.",
      phase: "operations",
      required: true,
      defaultResponsibleRole: "ops",
      dueOffsetDays: 5,
      linkedSignalKey: "first_route",
      onboardingStepHint: "configure_shipping",
    },
    {
      taskKey: "academy_distributor",
      title: "Completar curso de distribuidora",
      description: "Academy para mayorista / logística.",
      phase: "operations",
      required: false,
      defaultResponsibleRole: "admin",
      dueOffsetDays: 8,
      linkedCourseKey: "distribuidora-operaciones",
    },
  ],
  bar: [
    {
      taskKey: "academy_bar",
      title: "Completar curso de bar",
      description: "Academy para POS rápido e impresión comandera.",
      phase: "operations",
      required: false,
      defaultResponsibleRole: "admin",
      dueOffsetDays: 7,
      linkedCourseKey: "bar-servicio-rapido",
    },
  ],
  enterprise: [
    {
      taskKey: "security_pack_review",
      title: "Revisar Security Pack",
      description: "Validar procurement pack y requisitos enterprise.",
      phase: "readiness",
      required: true,
      defaultResponsibleRole: "support",
      dueOffsetDays: 6,
    },
    {
      taskKey: "iam_mfa_readiness",
      title: "Validar IAM/SSO/MFA",
      description: "Configurar y probar acceso empresarial.",
      phase: "setup",
      required: true,
      defaultResponsibleRole: "ops",
      dueOffsetDays: 6,
    },
  ],
};

function normalizeIcp(input: unknown): ImplementationIcp {
  const value = String(input ?? "kiosco").trim().toLowerCase();
  if (value === "distribuidora" || value === "bar" || value === "enterprise") return value;
  return "kiosco";
}

function toDateOrNull(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getImplementationChecklistTemplate(icp: unknown): ImplementationTemplateTask[] {
  const normalizedIcp = normalizeIcp(icp);
  const tasks = [...BASE_TEMPLATE_TASKS, ...(ICP_OVERRIDES[normalizedIcp] ?? [])];
  const unique = new Map<string, ImplementationTemplateTask>();
  for (const task of tasks) unique.set(task.taskKey, task);
  return Array.from(unique.values());
}

export function buildChecklistItemsFromTemplate(args: {
  icp: unknown;
  kickoffAt?: Date | string | null;
}) {
  const icp = normalizeIcp(args.icp);
  const kickoffAt = toDateOrNull(args.kickoffAt) ?? new Date();
  return getImplementationChecklistTemplate(icp).map((task, idx) => ({
    ...task,
    sortOrder: idx + 1,
    dueAt: new Date(kickoffAt.getTime() + task.dueOffsetDays * 24 * 60 * 60 * 1000),
  }));
}

export function blockedOnboardingStepHints(items: Array<{ status: string; onboardingStepHint?: string | null; taskKey?: string }>) {
  return items
    .filter((item) => !["DONE", "WAIVED"].includes(String(item.status)))
    .map((item) => String(item.onboardingStepHint ?? "").trim())
    .filter(Boolean);
}

export function computeImplementationReadiness(input: ReadinessInput) {
  const required = [...input.requiredTasks];
  const requiredCount = required.length;
  const doneRequired = required.filter((t) => t.status === "DONE" || t.status === "WAIVED").length;
  const blockedRequired = required.filter((t) => t.status === "BLOCKED").length;
  const checklistPct = requiredCount ? Math.round((doneRequired / requiredCount) * 100) : 0;

  let score = 0;
  score += Math.round(checklistPct * 0.55);
  score += Math.round(Math.max(0, Math.min(100, Number(input.activationScore ?? 0))) * 0.3);
  score += Math.min(10, Math.max(0, Number(input.toursCompleted ?? 0)) * 2);
  score += Math.min(10, Math.max(0, Number(input.academyCertifiedCount ?? 0)) * 5);
  if (Number(input.backupsVerified30d ?? 0) > 0) score += 5;
  if (Number(input.drDrills30d ?? 0) > 0) score += 5;
  if (blockedRequired > 0) score = Math.max(0, score - blockedRequired * 10);
  score = Math.max(0, Math.min(100, score));

  let color: ReadinessColor = "RED";
  if (blockedRequired === 0 && checklistPct >= 85 && (input.activationState === "ACTIVATED" || Number(input.activationScore ?? 0) >= 75)) {
    color = "GREEN";
  } else if (checklistPct >= 50 || Number(input.activationScore ?? 0) >= 35) {
    color = "YELLOW";
  }

  const reasons: string[] = [];
  if (blockedRequired > 0) reasons.push(`${blockedRequired} tareas requeridas bloqueadas`);
  if (checklistPct < 100) reasons.push(`Checklist requerido ${checklistPct}%`);
  if (Number(input.activationScore ?? 0) < 75) reasons.push(`Activation Score ${input.activationScore ?? 0}/100`);
  if (Number(input.backupsVerified30d ?? 0) <= 0) reasons.push("Sin restore verificado reciente");
  if (Number(input.drDrills30d ?? 0) <= 0) reasons.push("Sin DR drill reciente");

  return {
    color,
    score,
    checklistPct,
    doneRequired,
    requiredCount,
    blockedRequired,
    reasons,
  };
}

function actorLabel(actor?: string | null) {
  return String(actor ?? "implementation:system");
}

export async function upsertImplementationProject(prisma: AnyPrisma, input: {
  installationId: string;
  icp?: unknown;
  ownerUserId?: string | null;
  ownerName?: string | null;
  kickoffAt?: string | null;
  targetGoLiveAt?: string | null;
  status?: string | null;
  notes?: string | null;
  actor?: string | null;
  seedChecklist?: boolean;
}) {
  const installation = await prisma.installation.findUnique({
    where: { id: String(input.installationId) },
    select: { id: true, instanceId: true, clientName: true },
  });
  if (!installation) throw new Error("installation_not_found");
  const icp = normalizeIcp(input.icp);
  const allowedStatuses = new Set(["PLANNING", "IN_PROGRESS", "READY_FOR_GO_LIVE", "LIVE", "BLOCKED"]);
  const status = allowedStatuses.has(String(input.status ?? "").toUpperCase())
    ? String(input.status).toUpperCase()
    : undefined;

  const project = await prisma.implementationProject.upsert({
    where: { installationId: installation.id },
    create: {
      installationId: installation.id,
      instanceId: installation.instanceId,
      icp,
      ownerUserId: input.ownerUserId ? String(input.ownerUserId) : null,
      ownerName: input.ownerName ? String(input.ownerName) : null,
      kickoffAt: toDateOrNull(input.kickoffAt),
      targetGoLiveAt: toDateOrNull(input.targetGoLiveAt),
      status: (status ?? "PLANNING") as any,
      notes: input.notes ? String(input.notes) : null,
      createdBy: actorLabel(input.actor),
      updatedBy: actorLabel(input.actor),
    },
    update: {
      icp,
      ownerUserId: input.ownerUserId !== undefined ? (input.ownerUserId ? String(input.ownerUserId) : null) : undefined,
      ownerName: input.ownerName !== undefined ? (input.ownerName ? String(input.ownerName) : null) : undefined,
      kickoffAt: input.kickoffAt !== undefined ? toDateOrNull(input.kickoffAt) : undefined,
      targetGoLiveAt: input.targetGoLiveAt !== undefined ? toDateOrNull(input.targetGoLiveAt) : undefined,
      status: status ? (status as any) : undefined,
      notes: input.notes !== undefined ? (input.notes ? String(input.notes) : null) : undefined,
      updatedBy: actorLabel(input.actor),
    },
  });

  if (input.seedChecklist !== false) {
    await syncImplementationChecklistTemplate(prisma, {
      projectId: project.id,
      actor: input.actor ?? null,
    });
  }

  return prisma.implementationProject.findUnique({
    where: { id: project.id },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

export async function syncImplementationChecklistTemplate(prisma: AnyPrisma, input: {
  projectId: string;
  actor?: string | null;
}) {
  const project = await prisma.implementationProject.findUnique({
    where: { id: String(input.projectId) },
    include: { items: true },
  });
  if (!project) throw new Error("implementation_project_not_found");

  const template = buildChecklistItemsFromTemplate({ icp: project.icp, kickoffAt: project.kickoffAt ?? project.createdAt });
  const existingByKey = new Map((project.items ?? []).map((item: any) => [String(item.taskKey), item]));
  const touched: string[] = [];

  for (const task of template) {
    const existing = existingByKey.get(task.taskKey);
    if (!existing) {
      const created = await prisma.implementationChecklistItem.create({
        data: {
          projectId: project.id,
          installationId: project.installationId,
          instanceId: project.instanceId,
          taskKey: task.taskKey,
          title: task.title,
          description: task.description ?? null,
          phase: task.phase,
          required: task.required,
          status: "PENDING",
          responsibleRole: task.defaultResponsibleRole,
          dueAt: task.dueAt,
          source: "template",
          linkedSignalKey: task.linkedSignalKey ?? null,
          linkedCourseKey: task.linkedCourseKey ?? null,
          linkedTourKey: task.linkedTourKey ?? null,
          sortOrder: task.sortOrder,
          metadata: { onboardingStepHint: task.onboardingStepHint ?? null },
        },
      });
      touched.push(created.id);
      continue;
    }

    const existingAny = existing as any;
    const updateData: Record<string, unknown> = {
      title: task.title,
      description: task.description ?? null,
      phase: task.phase,
      required: task.required,
      linkedSignalKey: task.linkedSignalKey ?? null,
      linkedCourseKey: task.linkedCourseKey ?? null,
      linkedTourKey: task.linkedTourKey ?? null,
      sortOrder: task.sortOrder,
      metadata: {
        ...(typeof existingAny.metadata === "object" && existingAny.metadata ? (existingAny.metadata as Record<string, unknown>) : {}),
        onboardingStepHint: task.onboardingStepHint ?? null,
      },
    };
    if (!existingAny.dueAt) updateData.dueAt = task.dueAt;
    if (!existingAny.responsibleRole) updateData.responsibleRole = task.defaultResponsibleRole;
    const updated = await prisma.implementationChecklistItem.update({
      where: { id: existingAny.id },
      data: updateData,
    });
    touched.push(updated.id);
  }

  const payload = {
    kind: "implementation.checklist_sync",
    projectId: project.id,
    installationId: project.installationId,
    instanceId: project.instanceId,
    icp: project.icp,
    touchedCount: touched.length,
  };
  await prisma.complianceEvidence.create({
    data: {
      installationId: project.installationId,
      evidenceType: "implementation.checklist_sync",
      source: "control-plane",
      payload: payload as any,
      payloadHash: hashEvidencePayload(payload),
      sourceCapturedAt: new Date(),
      capturedBy: actorLabel(input.actor),
      tags: ["implementation", "checklist"],
    },
  }).catch(() => null);

  return prisma.implementationProject.findUnique({
    where: { id: project.id },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

export async function updateImplementationChecklistItem(prisma: AnyPrisma, input: {
  itemId: string;
  status?: string | null;
  responsibleRole?: string | null;
  responsibleUserId?: string | null;
  responsibleName?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  actor?: string | null;
}) {
  const allowed = new Set<ImplementationTaskStatus>(["PENDING", "IN_PROGRESS", "BLOCKED", "DONE", "WAIVED"]);
  const normalizedStatus = input.status ? String(input.status).toUpperCase() : null;
  if (normalizedStatus && !allowed.has(normalizedStatus as ImplementationTaskStatus)) {
    throw new Error("invalid_task_status");
  }
  const current = await prisma.implementationChecklistItem.findUnique({ where: { id: String(input.itemId) } });
  if (!current) throw new Error("implementation_item_not_found");
  const currentAny = current as any;
  const now = new Date();
  const nextStatus = (normalizedStatus ?? current.status) as ImplementationTaskStatus;
  const updated = await prisma.implementationChecklistItem.update({
    where: { id: current.id },
    data: {
      status: nextStatus as any,
      responsibleRole: input.responsibleRole !== undefined ? (input.responsibleRole ? String(input.responsibleRole) : null) : undefined,
      responsibleUserId: input.responsibleUserId !== undefined ? (input.responsibleUserId ? String(input.responsibleUserId) : null) : undefined,
      responsibleName: input.responsibleName !== undefined ? (input.responsibleName ? String(input.responsibleName) : null) : undefined,
      dueAt: input.dueAt !== undefined ? toDateOrNull(input.dueAt) : undefined,
      startedAt: nextStatus === "IN_PROGRESS" ? current.startedAt ?? now : current.startedAt,
      completedAt: nextStatus === "DONE" || nextStatus === "WAIVED" ? now : nextStatus === "PENDING" ? null : current.completedAt,
      metadata: {
        ...(typeof currentAny.metadata === "object" && currentAny.metadata ? (currentAny.metadata as Record<string, unknown>) : {}),
        notes: input.notes !== undefined ? (input.notes ? String(input.notes) : null) : currentAny.metadata?.notes ?? null,
        updatedBy: actorLabel(input.actor),
      },
    },
  });
  return updated;
}

export async function syncImplementationChecklistFromSignals(prisma: AnyPrisma, input: {
  installationId: string;
  actor?: string | null;
}) {
  const installation = await prisma.installation.findUnique({
    where: { id: String(input.installationId) },
    select: { id: true, instanceId: true },
  });
  if (!installation) throw new Error("installation_not_found");
  const project = await prisma.implementationProject.findUnique({
    where: { installationId: installation.id },
    include: { items: true },
  });
  if (!project) throw new Error("implementation_project_not_found");

  const activationData = await loadActivationScoresDashboard(prisma as any, { instanceId: installation.instanceId, take: 20 });
  const activation = (activationData.items ?? []).find((item: any) => item.instanceId === installation.instanceId) ?? null;
  const signalMap = new Map<string, boolean>((activation?.signals ?? []).map((s: any) => [String(s.key), Boolean(s.detected)]));

  const academy = await loadAcademyProgressDashboard(prisma as any, { instanceId: installation.instanceId, take: 50 }).catch(() => ({ instances: [] }));
  const academyRow = (academy.instances ?? []).find((row: any) => row.instanceId === installation.instanceId) ?? null;
  const academyCertifiedCount = Number(academyRow?.certificatesIssued ?? 0);
  const academyCompletedCourses = new Set(
    ((academyRow?.progressRows ?? []) as any[])
      .filter((row: any) => ["COMPLETED", "CERTIFIED"].includes(String(row.status)))
      .map((row: any) => String(row.courseKey)),
  );

  const tourStats = await prisma.productTourEvent.groupBy({
    by: ["eventType"],
    where: { installationId: installation.id },
    _count: { _all: true },
  }).catch(() => []);
  const toursCompleted = Number((tourStats as any[]).find((r: any) => String(r.eventType) === "COMPLETED")?._count?._all ?? 0);

  const changes: Array<{ itemId: string; from: string; to: string; reason: string }> = [];
  for (const item of project.items ?? []) {
    let shouldComplete = false;
    let reason = "";
    if (item.linkedSignalKey && signalMap.get(String(item.linkedSignalKey))) {
      shouldComplete = true;
      reason = `activation_signal:${item.linkedSignalKey}`;
    }
    if (!shouldComplete && item.linkedCourseKey && academyCompletedCourses.has(String(item.linkedCourseKey))) {
      shouldComplete = true;
      reason = `academy_course:${item.linkedCourseKey}`;
    }
    if (!shouldComplete && item.linkedTourKey && toursCompleted > 0) {
      shouldComplete = true;
      reason = `tour_completed:${item.linkedTourKey}`;
    }
    if (shouldComplete && !["DONE", "WAIVED"].includes(String(item.status))) {
      await prisma.implementationChecklistItem.update({
        where: { id: item.id },
        data: {
          status: "DONE",
          completedAt: item.completedAt ?? new Date(),
          metadata: {
            ...(typeof item.metadata === "object" && item.metadata ? (item.metadata as Record<string, unknown>) : {}),
            autoCompletedBy: reason,
          },
        },
      });
      changes.push({ itemId: item.id, from: String(item.status), to: "DONE", reason });
    }
  }

  const readiness = computeImplementationReadiness({
    requiredTasks: (await prisma.implementationChecklistItem.findMany({ where: { projectId: project.id } })).filter((i: any) => i.required),
    activationScore: activation?.score ?? 0,
    activationState: activation?.state ?? null,
    toursCompleted,
    academyCertifiedCount,
  });
  await prisma.implementationProject.update({
    where: { id: project.id },
    data: {
      lastReadinessColor: readiness.color,
      lastReadinessScore: readiness.score,
      status:
        project.status === "LIVE"
          ? "LIVE"
          : readiness.color === "GREEN"
            ? "READY_FOR_GO_LIVE"
            : readiness.color === "YELLOW"
              ? "IN_PROGRESS"
              : project.status === "BLOCKED"
                ? "BLOCKED"
                : "PLANNING",
      updatedBy: actorLabel(input.actor),
    },
  });

  return { changes, readiness };
}

export async function loadImplementationDashboard(prisma: AnyPrisma, args?: { installationId?: string | null; instanceId?: string | null }) {
  const installationId = String(args?.installationId ?? "").trim();
  const instanceIdFilter = String(args?.instanceId ?? "").trim();

  if (!installationId && !instanceIdFilter) {
    const projects = await prisma.implementationProject.findMany({
      include: { installation: { select: { id: true, instanceId: true, clientName: true, domain: true } }, items: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
    const rows = (projects as any[]).map((project) => {
      const required = (project.items ?? []).filter((i: any) => i.required);
      const readiness = computeImplementationReadiness({
        requiredTasks: required.map((i: any) => ({ taskKey: i.taskKey, status: i.status })),
        activationScore: project.lastReadinessScore ?? 0,
      });
      return {
        id: project.id,
        installationId: project.installationId,
        instanceId: project.instanceId,
        clientName: project.installation?.clientName ?? null,
        domain: project.installation?.domain ?? null,
        icp: project.icp,
        status: project.status,
        targetGoLiveAt: project.targetGoLiveAt,
        readiness,
      };
    });
    return { generatedAt: new Date().toISOString(), mode: "list", rows };
  }

  const installation =
    installationId
      ? await prisma.installation.findUnique({ where: { id: installationId } })
      : await prisma.installation.findUnique({ where: { instanceId: instanceIdFilter } });
  if (!installation) throw new Error("installation_not_found");

  let project = await prisma.implementationProject.findUnique({
    where: { installationId: installation.id },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!project) {
    project = await upsertImplementationProject(prisma, {
      installationId: installation.id,
      icp: "kiosco",
      seedChecklist: true,
      actor: "implementation:auto-seed",
    });
  }

  const [activationData, academyData, tourStats, backupCount30d, drDrills30d] = await Promise.all([
    loadActivationScoresDashboard(prisma as any, { instanceId: installation.instanceId, take: 20 }).catch(() => ({ items: [] })),
    loadAcademyProgressDashboard(prisma as any, { instanceId: installation.instanceId, take: 50 }).catch(() => ({ instances: [] })),
    prisma.productTourEvent
      .groupBy({
        by: ["eventType"],
        where: { installationId: installation.id },
        _count: { _all: true },
      })
      .catch(() => []),
    prisma.restoreVerification.count({
      where: { installationId: installation.id, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }).catch(() => 0),
    prisma.disasterRecoveryDrill.count({
      where: { installationId: installation.id, startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }).catch(() => 0),
  ]);

  const activation = (activationData.items ?? []).find((item: any) => item.instanceId === installation.instanceId) ?? null;
  const academy = (academyData.instances ?? []).find((row: any) => row.instanceId === installation.instanceId) ?? null;
  const tourCounts = {
    started: Number((tourStats as any[]).find((r: any) => String(r.eventType) === "STARTED")?._count?._all ?? 0),
    completed: Number((tourStats as any[]).find((r: any) => String(r.eventType) === "COMPLETED")?._count?._all ?? 0),
    abandoned: Number((tourStats as any[]).find((r: any) => String(r.eventType) === "ABANDONED")?._count?._all ?? 0),
  };

  const requiredTasks = (project.items ?? []).filter((item: any) => Boolean(item.required));
  const readiness = computeImplementationReadiness({
    requiredTasks: requiredTasks.map((item: any) => ({ taskKey: item.taskKey, status: item.status })),
    activationScore: activation?.score ?? 0,
    activationState: activation?.state ?? null,
    toursCompleted: tourCounts.completed,
    academyCertifiedCount: Number(academy?.certificatesIssued ?? 0),
    backupsVerified30d: Number(backupCount30d ?? 0),
    drDrills30d: Number(drDrills30d ?? 0),
  });

  const blockedHints = blockedOnboardingStepHints(
    (project.items ?? []).map((item: any) => ({
      status: item.status,
      onboardingStepHint: (item as any).metadata?.onboardingStepHint ?? null,
      taskKey: item.taskKey,
    })),
  );
  const academyRecommendations = recommendAcademyCoursesFromOnboarding({
    icp: project.icp,
    blockedStepKeys: blockedHints,
    locale: "es",
    limit: 3,
  });

  return {
    generatedAt: new Date().toISOString(),
    mode: "detail",
    installation: {
      id: installation.id,
      instanceId: installation.instanceId,
      clientName: installation.clientName ?? null,
      domain: installation.domain ?? null,
      version: installation.version ?? null,
      releaseChannel: installation.releaseChannel ?? null,
      healthStatus: installation.healthStatus ?? null,
    },
    project,
    integrations: {
      activation,
      tours: tourCounts,
      academy: academy
        ? {
            learners: academy.learners,
            coursesStarted: academy.coursesStarted,
            coursesCompleted: academy.coursesCompleted,
            certificatesIssued: academy.certificatesIssued,
            avgProgressPct: academy.avgProgressPct,
            progressRows: academy.progressRows ?? [],
          }
        : null,
      academyRecommendations,
    },
    goLiveReadiness: {
      ...readiness,
      semaphore: readiness.color,
      goLiveReportLinks: {
        pdf: `/api/go-live-report?installationId=${installation.id}&format=pdf`,
        json: `/api/go-live-report?installationId=${installation.id}&format=json`,
      },
    },
  };
}
