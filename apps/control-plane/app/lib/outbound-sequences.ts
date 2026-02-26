import crypto from "node:crypto";
import type { PrismaClient } from "./generated/prisma";
import { hashEvidencePayload } from "./compliance-evidence";

type AnyPrisma = PrismaClient | any;

export type SequenceStepInput = {
  stepOrder: number;
  delayDays?: number;
  name?: string;
  subjectTpl: string;
  bodyTpl: string;
  ctaUrlTpl?: string | null;
};

export type OutboundSequenceInput = {
  key: string;
  name: string;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  locale?: string;
  icpFilters?: string[];
  description?: string | null;
  steps: SequenceStepInput[];
  variables?: Record<string, unknown> | null;
};

const VALID_STATUSES = new Set(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);

export function normalizeStringArray(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(raw.map((v) => String(v ?? "").trim()).filter(Boolean)));
}

export function extractTemplateVariables(text: string) {
  const matches = String(text ?? "").match(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g) ?? [];
  return Array.from(
    new Set(
      matches
        .map((m) => m.replace(/[{}]/g, "").trim())
        .filter(Boolean),
    ),
  );
}

export function renderTemplate(text: string, vars: Record<string, unknown>) {
  return String(text ?? "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function normalizeOutboundSequenceInput(input: OutboundSequenceInput) {
  const key = String(input.key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) throw new Error("sequence_key_required");
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("sequence_name_required");
  const status = String(input.status ?? "DRAFT").toUpperCase();
  const normalizedStatus = VALID_STATUSES.has(status) ? status : "DRAFT";
  const steps = (Array.isArray(input.steps) ? input.steps : [])
    .map((step, idx) => {
      const stepOrder = Number(step.stepOrder ?? idx + 1);
      const subjectTpl = String(step.subjectTpl ?? "").trim();
      const bodyTpl = String(step.bodyTpl ?? "").trim();
      if (!Number.isFinite(stepOrder) || stepOrder < 1) throw new Error("invalid_step_order");
      if (!subjectTpl) throw new Error("step_subject_required");
      if (!bodyTpl) throw new Error("step_body_required");
      const delayDays = Math.max(0, Math.min(365, Number(step.delayDays ?? 0)));
      const ctaUrlTpl = step.ctaUrlTpl ? String(step.ctaUrlTpl).trim() : null;
      const variablesUsed = Array.from(new Set([...extractTemplateVariables(subjectTpl), ...extractTemplateVariables(bodyTpl), ...(ctaUrlTpl ? extractTemplateVariables(ctaUrlTpl) : [])]));
      return {
        stepOrder,
        delayDays,
        name: String(step.name ?? `Paso ${stepOrder}`).trim() || `Paso ${stepOrder}`,
        subjectTpl,
        bodyTpl,
        ctaUrlTpl,
        variablesUsed,
      };
    })
    .sort((a, b) => a.stepOrder - b.stepOrder);
  if (steps.length === 0) throw new Error("sequence_steps_required");
  for (let i = 0; i < steps.length; i += 1) {
    if (steps[i].stepOrder !== i + 1) {
      steps[i].stepOrder = i + 1;
    }
  }

  return {
    key,
    name,
    status: normalizedStatus as "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED",
    locale: String(input.locale ?? "es").slice(0, 8),
    icpFilters: Array.from(new Set(normalizeStringArray(input.icpFilters).map((v) => v.toLowerCase()))),
    description: input.description ? String(input.description) : null,
    variables: input.variables && typeof input.variables === "object" && !Array.isArray(input.variables) ? input.variables : null,
    steps,
  };
}

function hashToken(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function createTrackingToken(input: { enrollmentId: string; stepId: string; kind: "open" | "click"; at?: Date }) {
  const at = input.at ?? new Date();
  return crypto
    .createHash("sha256")
    .update(`${input.kind}:${input.enrollmentId}:${input.stepId}:${at.toISOString()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 48);
}

export function scheduleDate(base: Date, delayDays: number) {
  return new Date(base.getTime() + Math.max(0, Number(delayDays || 0)) * 24 * 60 * 60 * 1000);
}

function inferLeadIcp(lead: any) {
  const tags: string[] = Array.isArray(lead.tags) ? lead.tags.map((t: any) => String(t).toLowerCase()) : [];
  const fromTag = tags.find((t) => t.startsWith("icp:"));
  if (fromTag) return fromTag.replace(/^icp:/, "");
  const bt = String(lead.businessType ?? "").toLowerCase();
  if (bt.includes("distrib")) return "distribuidora";
  if (bt.includes("bar")) return "bar";
  return "kiosco";
}

function leadMatchesIcp(lead: any, icpFilters: string[]) {
  if (!icpFilters.length) return true;
  const icp = inferLeadIcp(lead);
  return icpFilters.includes(icp);
}

export async function upsertOutboundSequence(prisma: AnyPrisma, input: { sequence: OutboundSequenceInput; actor: string }) {
  const seq = normalizeOutboundSequenceInput(input.sequence);
  const existing = await prisma.outboundSequence.findUnique({
    where: { key: seq.key },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!existing) {
    return prisma.outboundSequence.create({
      data: {
        key: seq.key,
        name: seq.name,
        status: seq.status,
        locale: seq.locale,
        icpFilters: seq.icpFilters,
        description: seq.description,
        variables: seq.variables as any,
        createdBy: input.actor,
        updatedBy: input.actor,
        steps: {
          create: seq.steps.map((step) => ({
            stepOrder: step.stepOrder,
            delayDays: step.delayDays,
            name: step.name,
            subjectTpl: step.subjectTpl,
            bodyTpl: step.bodyTpl,
            ctaUrlTpl: step.ctaUrlTpl,
            variablesUsed: step.variablesUsed,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  return prisma.$transaction(async (tx: AnyPrisma) => {
    await tx.outboundSequence.update({
      where: { id: existing.id },
      data: {
        name: seq.name,
        status: seq.status,
        locale: seq.locale,
        icpFilters: seq.icpFilters,
        description: seq.description,
        variables: seq.variables as any,
        updatedBy: input.actor,
      },
    });
    await tx.outboundSequenceStep.deleteMany({ where: { sequenceId: existing.id } });
    const updated = await tx.outboundSequence.update({
      where: { id: existing.id },
      data: {
        steps: {
          create: seq.steps.map((step) => ({
            stepOrder: step.stepOrder,
            delayDays: step.delayDays,
            name: step.name,
            subjectTpl: step.subjectTpl,
            bodyTpl: step.bodyTpl,
            ctaUrlTpl: step.ctaUrlTpl,
            variablesUsed: step.variablesUsed,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    return updated;
  });
}

export async function enrollOutboundSequenceByIcp(
  prisma: AnyPrisma,
  input: { sequenceId: string; actor: string; icp?: string | null; limit?: number | null },
) {
  const sequence = await prisma.outboundSequence.findUnique({
    where: { id: input.sequenceId },
    include: { steps: { orderBy: { stepOrder: "asc" }, take: 1 } },
  });
  if (!sequence) throw new Error("sequence_not_found");
  if (!sequence.steps.length) throw new Error("sequence_has_no_steps");

  const targetIcp = input.icp ? String(input.icp).toLowerCase() : null;
  const leads = await prisma.crmLead.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: Math.min(500, Math.max(1, Number(input.limit ?? 100))),
  });

  const optOutRows = await prisma.outboundSequenceOptOut.findMany({
    where: { email: { in: leads.map((l: any) => String(l.email ?? "").toLowerCase()).filter(Boolean) } },
    select: { email: true },
  });
  const optOutSet = new Set(optOutRows.map((r: any) => String(r.email).toLowerCase()));

  let enrolled = 0;
  let skippedOptOut = 0;
  let skippedNoEmail = 0;
  let skippedIcp = 0;
  let existing = 0;
  const details: any[] = [];

  for (const lead of leads) {
    const leadIcp = inferLeadIcp(lead);
    if (targetIcp && leadIcp !== targetIcp) {
      skippedIcp += 1;
      continue;
    }
    if (!leadMatchesIcp(lead, sequence.icpFilters ?? [])) {
      skippedIcp += 1;
      continue;
    }
    const email = String(lead.email ?? "").toLowerCase().trim();
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }
    if (optOutSet.has(email)) {
      skippedOptOut += 1;
      continue;
    }

    const found = await prisma.outboundSequenceEnrollment.findUnique({
      where: { sequenceId_leadId: { sequenceId: sequence.id, leadId: lead.id } },
    });
    if (found) {
      existing += 1;
      continue;
    }

    const primaryDeal = await prisma.crmDeal.findFirst({
      where: { leadId: lead.id },
      orderBy: { updatedAt: "desc" },
    });

    const enrollment = await prisma.outboundSequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        leadId: lead.id,
        dealId: primaryDeal?.id ?? null,
        installationId: lead.installationId ?? null,
        instanceId: lead.instanceId ?? null,
        email,
        status: "ACTIVE",
        currentStepOrder: 1,
        nextRunAt: new Date(),
        source: targetIcp ? `assign_icp:${targetIcp}` : "assign_sequence",
        metadata: {
          inferredIcp: leadIcp,
          assignedBy: input.actor,
        },
      },
    });
    await prisma.outboundSequenceEvent.create({
      data: {
        sequenceId: sequence.id,
        enrollmentId: enrollment.id,
        leadId: lead.id,
        dealId: primaryDeal?.id ?? null,
        eventType: "ENROLLED",
        provider: "system",
        metadata: {
          actor: input.actor,
          leadIcp,
          sequenceKey: sequence.key,
        },
      },
    });
    enrolled += 1;
    details.push({ leadId: lead.id, email, companyName: lead.companyName ?? null, inferredIcp: leadIcp });
  }

  return { enrolled, existing, skippedOptOut, skippedNoEmail, skippedIcp, details: details.slice(0, 50) };
}

function baseTrackingUrl(path: string, params: Record<string, string>) {
  const base = (process.env.CONTROL_PLANE_URL ?? process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3010").replace(/\/$/, "");
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function buildLeadVariables(input: { lead: any; deal: any; sequence: any; step: any; enrollment: any; openUrl: string; clickUrl: string; unsubscribeUrl: string }) {
  return {
    companyName: input.lead.companyName ?? "",
    contactName: input.lead.name ?? "",
    city: input.lead.city ?? "",
    businessType: input.lead.businessType ?? "",
    email: input.enrollment.email ?? "",
    sequenceName: input.sequence.name ?? "",
    stepName: input.step.name ?? "",
    dealTitle: input.deal?.title ?? "",
    unsubscribeUrl: input.unsubscribeUrl,
    openTrackingUrl: input.openUrl,
    clickTrackingUrl: input.clickUrl,
  };
}

async function createComplianceBlockedEvent(prisma: AnyPrisma, enrollment: any, reason: string) {
  await prisma.outboundSequenceEvent.create({
    data: {
      sequenceId: enrollment.sequenceId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      dealId: enrollment.dealId ?? null,
      eventType: "COMPLIANCE_BLOCKED",
      provider: "system",
      metadata: { reason },
    },
  });
}

export async function dispatchDueOutboundSequenceSteps(prisma: AnyPrisma, input: { actor: string; now?: Date; limit?: number }) {
  const now = input.now ?? new Date();
  const dueEnrollments = await prisma.outboundSequenceEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      sequence: { status: "ACTIVE" },
    },
    include: {
      sequence: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
    },
    orderBy: [{ nextRunAt: "asc" }],
    take: Math.min(200, Math.max(1, Number(input.limit ?? 50))),
  });

  const emailSet = Array.from(new Set(dueEnrollments.map((e: any) => String(e.email ?? "").toLowerCase()).filter(Boolean)));
  const optOuts = emailSet.length ? await prisma.outboundSequenceOptOut.findMany({ where: { email: { in: emailSet } } }) : [];
  const optOutSet = new Set(optOuts.map((o: any) => String(o.email).toLowerCase()));

  const summary = { processed: 0, sent: 0, completed: 0, blockedOptOut: 0, skipped: 0, errors: 0 };
  const logs: any[] = [];

  for (const enrollment of dueEnrollments) {
    summary.processed += 1;
    try {
      const email = String(enrollment.email ?? "").toLowerCase();
      if (!email || optOutSet.has(email)) {
        await prisma.outboundSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "OPTED_OUT", optedOutAt: now, nextRunAt: null },
        });
        await createComplianceBlockedEvent(prisma, enrollment, !email ? "missing_email" : "opt_out");
        summary.blockedOptOut += 1;
        logs.push({ enrollmentId: enrollment.id, status: "blocked", reason: !email ? "missing_email" : "opt_out" });
        continue;
      }

      const step = (enrollment.sequence.steps ?? []).find((s: any) => Number(s.stepOrder) === Number(enrollment.currentStepOrder));
      if (!step) {
        await prisma.outboundSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "COMPLETED", completedAt: now, nextRunAt: null },
        });
        await prisma.outboundSequenceEvent.create({
          data: {
            sequenceId: enrollment.sequenceId,
            enrollmentId: enrollment.id,
            leadId: enrollment.leadId,
            dealId: enrollment.dealId ?? null,
            eventType: "COMPLETED",
            provider: "system",
          },
        });
        summary.completed += 1;
        logs.push({ enrollmentId: enrollment.id, status: "completed_no_step" });
        continue;
      }

      const [lead, deal] = await Promise.all([
        prisma.crmLead.findUnique({ where: { id: enrollment.leadId } }),
        enrollment.dealId ? prisma.crmDeal.findUnique({ where: { id: enrollment.dealId } }) : null,
      ]);
      if (!lead) {
        await prisma.outboundSequenceEvent.create({
          data: {
            sequenceId: enrollment.sequenceId,
            enrollmentId: enrollment.id,
            leadId: enrollment.leadId,
            dealId: enrollment.dealId ?? null,
            eventType: "STEP_SKIPPED",
            provider: "system",
            metadata: { reason: "lead_not_found", stepOrder: step.stepOrder },
          },
        });
        await prisma.outboundSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "STOPPED", nextRunAt: null },
        });
        summary.skipped += 1;
        logs.push({ enrollmentId: enrollment.id, status: "stopped", reason: "lead_not_found" });
        continue;
      }

      const sentAt = now;
      const openToken = createTrackingToken({ enrollmentId: enrollment.id, stepId: step.id, kind: "open", at: sentAt });
      const clickToken = createTrackingToken({ enrollmentId: enrollment.id, stepId: step.id, kind: "click", at: sentAt });
      const unsubscribeToken = hashToken(`unsub:${enrollment.id}:${email}`);
      const openUrl = baseTrackingUrl("/api/outbound-sequences/track/open", { t: openToken });
      const clickUrl = baseTrackingUrl("/api/outbound-sequences/track/click", { t: clickToken });
      const unsubscribeUrl = baseTrackingUrl("/api/outbound-sequences/unsubscribe", { t: unsubscribeToken, e: email });
      const vars = buildLeadVariables({
        lead,
        deal,
        sequence: enrollment.sequence,
        step,
        enrollment,
        openUrl,
        clickUrl,
        unsubscribeUrl,
      });

      const subject = renderTemplate(step.subjectTpl, vars);
      const body = `${renderTemplate(step.bodyTpl, vars)}\n\n<img src="${openUrl}" alt="" width="1" height="1" />`;
      const ctaUrl = step.ctaUrlTpl ? renderTemplate(step.ctaUrlTpl, vars) : null;

      const sentEvent = await prisma.outboundSequenceEvent.create({
        data: {
          sequenceId: enrollment.sequenceId,
          enrollmentId: enrollment.id,
          stepId: step.id,
          leadId: enrollment.leadId,
          dealId: enrollment.dealId ?? null,
          eventType: "SENT",
          occurredAt: sentAt,
          provider: "mock-email",
          trackingToken: openToken,
          metadata: {
            actor: input.actor,
            stepOrder: step.stepOrder,
            subject,
            bodyPreview: body.slice(0, 500),
            ctaUrl,
            openToken,
            clickToken,
            unsubscribeToken,
            email,
          },
        },
      });

      if (ctaUrl) {
        // reserve click token as metadata-only reference through a placeholder event record
        await prisma.outboundSequenceEvent.create({
          data: {
            sequenceId: enrollment.sequenceId,
            enrollmentId: enrollment.id,
            stepId: step.id,
            leadId: enrollment.leadId,
            dealId: enrollment.dealId ?? null,
            eventType: "STEP_SKIPPED",
            occurredAt: sentAt,
            provider: "mock-email",
            trackingToken: clickToken,
            metadata: {
              kind: "click_token_reference",
              ctaUrl,
              sentEventId: sentEvent.id,
            },
          },
        });
      }

      const nextStep = (enrollment.sequence.steps ?? []).find((s: any) => Number(s.stepOrder) === Number(step.stepOrder) + 1);
      if (!nextStep) {
        await prisma.outboundSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            lastSentAt: sentAt,
            completedAt: sentAt,
            nextRunAt: null,
            status: "COMPLETED",
            currentStepOrder: step.stepOrder,
          },
        });
        await prisma.outboundSequenceEvent.create({
          data: {
            sequenceId: enrollment.sequenceId,
            enrollmentId: enrollment.id,
            leadId: enrollment.leadId,
            dealId: enrollment.dealId ?? null,
            eventType: "COMPLETED",
            occurredAt: sentAt,
            provider: "system",
            metadata: { afterStepOrder: step.stepOrder },
          },
        });
        summary.completed += 1;
      } else {
        await prisma.outboundSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            lastSentAt: sentAt,
            currentStepOrder: nextStep.stepOrder,
            nextRunAt: scheduleDate(sentAt, nextStep.delayDays),
            status: "ACTIVE",
          },
        });
      }
      summary.sent += 1;
      logs.push({ enrollmentId: enrollment.id, status: "sent", stepOrder: step.stepOrder, nextStepOrder: nextStep?.stepOrder ?? null });
    } catch (error: any) {
      summary.errors += 1;
      logs.push({ enrollmentId: enrollment.id, status: "error", error: String(error?.message ?? "unknown") });
    }
  }

  const evidencePayload = {
    kind: "outbound_sequence_dispatch_batch",
    actor: input.actor,
    runAt: now.toISOString(),
    summary,
    logs: logs.slice(0, 200),
  };
  await prisma.complianceEvidence.create({
    data: {
      installationId: null,
      evidenceType: "outbound_sequences.dispatch_batch",
      source: "control-plane",
      payload: evidencePayload,
      payloadHash: hashEvidencePayload(evidencePayload),
      sourceCapturedAt: now,
      capturedBy: input.actor,
      tags: ["marketing", "outbound-sequences", "email"],
    },
  });

  return { summary, logs: logs.slice(0, 200) };
}

function hashNullable(value: string | null | undefined) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function trackOutboundSequenceEventByToken(
  prisma: AnyPrisma,
  input: { token: string; kind: "open" | "click"; url?: string | null; ip?: string | null; userAgent?: string | null },
) {
  const token = String(input.token ?? "").trim();
  if (!token) throw new Error("token_required");
  const tokenRef = await prisma.outboundSequenceEvent.findUnique({
    where: { trackingToken: token },
  });
  if (!tokenRef) throw new Error("tracking_token_not_found");

  const eventType = input.kind === "open" ? "OPEN" : "CLICK";
  const metadata = (tokenRef.metadata ?? {}) as any;

  const duplicate = await prisma.outboundSequenceEvent.findFirst({
    where: {
      enrollmentId: tokenRef.enrollmentId ?? undefined,
      stepId: tokenRef.stepId ?? undefined,
      eventType,
      metadata: {
        path: ["trackingToken"],
        equals: token,
      },
    },
  }).catch(() => null);

  if (!duplicate) {
    await prisma.outboundSequenceEvent.create({
      data: {
        sequenceId: tokenRef.sequenceId,
        enrollmentId: tokenRef.enrollmentId ?? null,
        stepId: tokenRef.stepId ?? null,
        leadId: tokenRef.leadId ?? null,
        dealId: tokenRef.dealId ?? null,
        eventType,
        provider: "tracking",
        url: input.kind === "click" ? String(input.url ?? metadata?.ctaUrl ?? tokenRef.url ?? "") || null : null,
        ipHash: hashNullable(input.ip),
        userAgentHash: hashNullable(input.userAgent),
        metadata: {
          trackingToken: token,
          sourceEventId: tokenRef.id,
        },
      },
    });
  }

  return {
    tokenRef,
    redirectUrl: input.kind === "click" ? String(input.url ?? metadata?.ctaUrl ?? tokenRef.url ?? "") || null : null,
  };
}

export async function unsubscribeOutboundRecipient(
  prisma: AnyPrisma,
  input: { email: string; source?: string; reason?: string | null; ip?: string | null; userAgent?: string | null },
) {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("email_required");
  const optOut = await prisma.outboundSequenceOptOut.upsert({
    where: { email },
    create: {
      email,
      source: input.source ? String(input.source) : "unsubscribe_link",
      reason: input.reason ? String(input.reason) : null,
      ipHash: hashNullable(input.ip),
      userAgentHash: hashNullable(input.userAgent),
    },
    update: {
      source: input.source ? String(input.source) : "unsubscribe_link",
      reason: input.reason ? String(input.reason) : null,
      ipHash: hashNullable(input.ip),
      userAgentHash: hashNullable(input.userAgent),
    },
  });

  const enrollments = await prisma.outboundSequenceEnrollment.findMany({
    where: { email, status: { in: ["ACTIVE", "PAUSED"] } },
  });
  for (const enrollment of enrollments) {
    await prisma.outboundSequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "OPTED_OUT", optedOutAt: new Date(), nextRunAt: null },
    });
    await prisma.outboundSequenceEvent.create({
      data: {
        sequenceId: enrollment.sequenceId,
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        dealId: enrollment.dealId ?? null,
        eventType: "UNSUBSCRIBE",
        provider: "unsubscribe",
        ipHash: hashNullable(input.ip),
        userAgentHash: hashNullable(input.userAgent),
        metadata: {
          source: input.source ?? "unsubscribe_link",
          reason: input.reason ?? null,
          emailHash: hashNullable(email),
        },
      },
    });
  }

  return { optOut, affectedEnrollments: enrollments.length };
}

export async function loadOutboundSequencesDashboard(prisma: AnyPrisma) {
  const [sequences, events, enrollments, optOutCount, icpLeadCounts] = await Promise.all([
    prisma.outboundSequence.findMany({
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { enrollments: true, events: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.outboundSequenceEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.outboundSequenceEnrollment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.outboundSequenceOptOut.count(),
    prisma.crmLead.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, businessType: true, tags: true },
      take: 5000,
    }),
  ]);

  const icpCounts: Record<string, number> = {};
  for (const lead of icpLeadCounts) {
    const icp = inferLeadIcp(lead);
    icpCounts[icp] = (icpCounts[icp] ?? 0) + 1;
  }

  const metrics = {
    sent: events.filter((e: any) => e.eventType === "SENT").length,
    opens: events.filter((e: any) => e.eventType === "OPEN").length,
    clicks: events.filter((e: any) => e.eventType === "CLICK").length,
    unsubscribes: events.filter((e: any) => e.eventType === "UNSUBSCRIBE").length,
    complianceBlocked: events.filter((e: any) => e.eventType === "COMPLIANCE_BLOCKED").length,
    activeEnrollments: enrollments.filter((e: any) => e.status === "ACTIVE").length,
    optOutCount,
  };

  return {
    generatedAt: new Date().toISOString(),
    sequences,
    recentEvents: events,
    recentEnrollments: enrollments,
    leadPoolByIcp: icpCounts,
    metrics,
  };
}
