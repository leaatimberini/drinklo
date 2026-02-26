import assert from "node:assert/strict";
import test from "node:test";
import { ensureCaseStudyPublishable, generateCaseStudyDraftFromInput, publishCaseStudy } from "./case-studies";

test("case study generator builds deterministic draft from fixtures", () => {
  const draft = generateCaseStudyDraftFromInput({
    installation: {
      id: "inst-1",
      instanceId: "acme-001",
      clientName: "Bebidas Acme",
      domain: "acme.test",
      version: "1.2.3",
      releaseChannel: "stable",
      healthStatus: "ok",
    },
    billingAccount: {
      id: "ba-1",
      planName: "C2 Distribuidora",
      planTier: "C2",
      provider: "MERCADOPAGO",
      monthlyOrders: 320,
      monthlyGmvArs: 1580000,
      createdAt: "2026-01-10T12:00:00.000Z",
    },
    activation: {
      score: 90,
      state: "ACTIVATED",
      signals: [
        { key: "catalog_imported", detected: true, label: "Catálogo importado" },
        { key: "mercadopago_connected", detected: true, label: "Mercado Pago conectado" },
      ],
    },
    nps: {
      responses: 8,
      nps: 63,
      latestComment: "Rápido onboarding y mejor control de stock.",
      csatAvg: 4.6,
    },
    usage: {
      logins30d: 48,
      pos30d: 125,
      campaigns30d: 6,
      orders30d: 320,
    },
    crm: {
      dealId: "deal-1",
      stage: "WON",
      businessType: "distribuidora",
      notes: ["Necesitaban listas mayoristas y reparto propio en menos de 3 semanas."],
      ownerUserId: "csm-1",
    },
  });

  assert.equal(draft.icp, "distribuidora");
  assert.match(draft.title, /Bebidas Acme/i);
  assert.equal(draft.metrics.after.find((m) => m.key === "orders")?.value, 320);
  assert.equal(draft.metrics.highlights.find((m) => m.key === "nps")?.value, 63);
  assert.match(draft.content.problem, /listas mayoristas/i);
  assert.equal(draft.content.sources.crmNotesUsed, 1);
});

test("publish requires approval and blocks direct publish", async () => {
  await assert.rejects(
    ensureCaseStudyPublishable({
      id: "cs1",
      status: "DRAFT",
      approvalRequired: true,
      approvedAt: null,
    }),
    /approval_required/,
  );

  const prisma = {
    caseStudy: {
      findUnique: async () => ({
        id: "cs1",
        installationId: "inst1",
        status: "DRAFT",
        approvalRequired: true,
        approvedAt: null,
        publishedAt: null,
        publishedBy: null,
        slug: "case-1",
      }),
      update: async () => {
        throw new Error("should_not_publish");
      },
    },
  } as any;

  await assert.rejects(
    publishCaseStudy(prisma, { id: "cs1", actor: "admin" }),
    /approval_required/,
  );
});

