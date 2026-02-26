import assert from "node:assert/strict";
import test from "node:test";
import {
  enrollOutboundSequenceByIcp,
  normalizeOutboundSequenceInput,
  renderTemplate,
  scheduleDate,
  trackOutboundSequenceEventByToken,
  unsubscribeOutboundRecipient,
} from "./outbound-sequences";

test("normalize outbound sequence keeps steps ordered and extracts variables", () => {
  const normalized = normalizeOutboundSequenceInput({
    key: " Trial Welcome ",
    name: "Trial Welcome",
    icpFilters: ["Kiosco", "distribuidora", "kiosco"],
    steps: [
      {
        stepOrder: 2,
        delayDays: 3,
        subjectTpl: "D+3 para {{companyName}}",
        bodyTpl: "Hola {{contactName}}",
        ctaUrlTpl: "https://example.com/{{city}}",
      },
      {
        stepOrder: 1,
        delayDays: 0,
        subjectTpl: "Inicio",
        bodyTpl: "Bienvenido {{companyName}}",
      },
    ],
  });

  assert.equal(normalized.key, "trial-welcome");
  assert.deepEqual(normalized.icpFilters, ["kiosco", "distribuidora"]);
  assert.equal(normalized.steps[0].stepOrder, 1);
  assert.equal(normalized.steps[1].stepOrder, 2);
  assert.equal(normalized.steps[1].variablesUsed.includes("companyName"), true);
  assert.equal(normalized.steps[1].variablesUsed.includes("contactName"), true);
  assert.equal(normalized.steps[1].variablesUsed.includes("city"), true);
});

test("render template + schedule date are deterministic", () => {
  const rendered = renderTemplate("Hola {{name}} - {{missing}}", { name: "Acme" });
  assert.equal(rendered, "Hola Acme - ");

  const base = new Date("2026-02-01T12:00:00.000Z");
  const next = scheduleDate(base, 3);
  assert.equal(next.toISOString(), "2026-02-04T12:00:00.000Z");
});

test("enroll by ICP skips opt-outs and creates enrollments for matching leads", async () => {
  const createdEnrollments: any[] = [];
  const createdEvents: any[] = [];
  const existingEnrollmentKeys = new Set<string>();

  const prisma = {
    outboundSequence: {
      findUnique: async () => ({
        id: "seq_1",
        key: "trial-nurture",
        icpFilters: ["kiosco"],
        steps: [{ id: "step_1", stepOrder: 1 }],
      }),
    },
    crmLead: {
      findMany: async () => [
        {
          id: "lead_1",
          email: "uno@example.com",
          businessType: "Kiosco",
          tags: ["icp:kiosco"],
          companyName: "Uno",
          updatedAt: new Date().toISOString(),
        },
        {
          id: "lead_2",
          email: "optout@example.com",
          businessType: "Kiosco",
          tags: ["icp:kiosco"],
          companyName: "Dos",
        },
        {
          id: "lead_3",
          email: "dist@example.com",
          businessType: "Distribuidora",
          tags: ["icp:distribuidora"],
          companyName: "Tres",
        },
      ],
    },
    outboundSequenceOptOut: {
      findMany: async () => [{ email: "optout@example.com" }],
    },
    outboundSequenceEnrollment: {
      findUnique: async ({ where }: any) => {
        const key = `${where.sequenceId_leadId.sequenceId}:${where.sequenceId_leadId.leadId}`;
        return existingEnrollmentKeys.has(key) ? { id: "existing" } : null;
      },
      create: async ({ data }: any) => {
        const created = { id: `enr_${createdEnrollments.length + 1}`, ...data };
        createdEnrollments.push(created);
        existingEnrollmentKeys.add(`${data.sequenceId}:${data.leadId}`);
        return created;
      },
    },
    crmDeal: {
      findFirst: async () => null,
    },
    outboundSequenceEvent: {
      create: async ({ data }: any) => {
        createdEvents.push(data);
        return { id: `evt_${createdEvents.length}`, ...data };
      },
    },
  };

  const result = await enrollOutboundSequenceByIcp(prisma as any, {
    sequenceId: "seq_1",
    actor: "tester",
    icp: "kiosco",
    limit: 10,
  });

  assert.equal(result.enrolled, 1);
  assert.equal(result.skippedOptOut, 1);
  assert.equal(result.skippedIcp, 1);
  assert.equal(createdEnrollments[0].email, "uno@example.com");
  assert.equal(createdEvents[0].eventType, "ENROLLED");
});

test("tracking by token records click once and preserves redirect", async () => {
  const events: any[] = [
    {
      id: "evt_sent",
      sequenceId: "seq_1",
      enrollmentId: "enr_1",
      stepId: "step_1",
      leadId: "lead_1",
      dealId: "deal_1",
      eventType: "STEP_SKIPPED",
      trackingToken: "clicktoken",
      url: null,
      metadata: { ctaUrl: "https://example.com/oferta" },
    },
  ];

  const prisma = {
    outboundSequenceEvent: {
      findUnique: async ({ where }: any) => events.find((e) => e.trackingToken === where.trackingToken) ?? null,
      findFirst: async ({ where }: any) =>
        events.find(
          (e) =>
            e.enrollmentId === where.enrollmentId &&
            e.stepId === where.stepId &&
            e.eventType === where.eventType &&
            e.metadata?.trackingToken === where.metadata?.equals,
        ) ?? null,
      create: async ({ data }: any) => {
        const created = { id: `evt_${events.length + 1}`, ...data };
        events.push(created);
        return created;
      },
    },
  };

  const first = await trackOutboundSequenceEventByToken(prisma as any, {
    token: "clicktoken",
    kind: "click",
    ip: "1.2.3.4",
    userAgent: "test-agent",
  });
  const second = await trackOutboundSequenceEventByToken(prisma as any, {
    token: "clicktoken",
    kind: "click",
  });

  assert.equal(first.redirectUrl, "https://example.com/oferta");
  assert.equal(second.redirectUrl, "https://example.com/oferta");
  assert.equal(events.filter((e) => e.eventType === "CLICK").length, 1);
});

test("unsubscribe creates opt-out and updates active enrollments", async () => {
  const updates: any[] = [];
  const createdEvents: any[] = [];
  const enrollments = [
    { id: "enr_1", sequenceId: "seq_1", leadId: "lead_1", dealId: null, email: "x@example.com", status: "ACTIVE" },
    { id: "enr_2", sequenceId: "seq_2", leadId: "lead_2", dealId: null, email: "x@example.com", status: "PAUSED" },
  ];

  const prisma = {
    outboundSequenceOptOut: {
      upsert: async ({ create, update }: any) => ({ id: "opt_1", ...create, ...update }),
    },
    outboundSequenceEnrollment: {
      findMany: async () => enrollments,
      update: async ({ where, data }: any) => {
        updates.push({ where, data });
        return { id: where.id, ...data };
      },
    },
    outboundSequenceEvent: {
      create: async ({ data }: any) => {
        createdEvents.push(data);
        return { id: `evt_${createdEvents.length}`, ...data };
      },
    },
  };

  const result = await unsubscribeOutboundRecipient(prisma as any, {
    email: "X@example.com",
    source: "test",
    reason: "opt_out_request",
    ip: "1.2.3.4",
    userAgent: "ua",
  });

  assert.equal(result.affectedEnrollments, 2);
  assert.equal(updates.length, 2);
  assert.equal(createdEvents.length, 2);
  assert.equal(createdEvents.every((e) => e.eventType === "UNSUBSCRIBE"), true);
});

