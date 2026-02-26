import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProposalRenderedPayload,
  calculateProposalPricing,
  generateProposalExport,
  normalizeProposalTemplateInput,
  signProposalBundle,
  verifyProposalBundleSignature,
} from "./proposal-builder";

test("proposal template normalization and rendering variables", () => {
  const tpl = normalizeProposalTemplateInput({
    key: " SOW C1 ",
    name: "SOW C1",
    planTier: "c1",
    sections: [
      { key: "alcance", title: "Alcance", bodyTpl: "{{scope}}" },
      { key: "costos", title: "Costos", bodyTpl: "Total {{pricingTotal}}" },
    ],
  });
  assert.equal(tpl.key, "sow-c1");
  assert.equal(tpl.planTier, "C1");
  assert.equal(tpl.sections.length, 2);

  const pricing = calculateProposalPricing({
    currency: "usd",
    baseAmount: 100,
    addonItems: [{ key: "andreani", amount: 50 }],
    discountPct: 10,
  });
  assert.equal(pricing.total, 135);

  const rendered = buildProposalRenderedPayload({
    template: { key: "sow-c1", name: "SOW C1", locale: "es", sections: tpl.sections },
    variables: { scope: "Implementación básica", costs: "Setup + capacitación", exclusions: "No custom", timeline: "2 semanas" },
    pricing,
    planTier: "C1",
    addonKeys: ["andreani"],
    clientName: "Acme",
  });
  assert.equal(rendered.proposal.clientName, "Acme");
  assert.equal(rendered.proposal.sections[0].body, "Implementación básica");
  assert.match(rendered.proposal.sections[1].body, /135\.00 USD/);
});

test("proposal signing verification detects tampering", () => {
  const payload = {
    generatedAt: "2026-02-26T12:00:00.000Z",
    template: { key: "sow-c1" },
    proposal: { clientName: "Acme", planTier: "C1", addonKeys: [] },
  };
  const signed = signProposalBundle(payload, { pdfHash: "abc123", secret: "test-secret" });
  assert.equal(
    verifyProposalBundleSignature({ payload, manifest: signed.manifest, signature: signed.signature }, "test-secret"),
    true,
  );
  assert.equal(
    verifyProposalBundleSignature(
      {
        payload: { ...payload, proposal: { ...payload.proposal, clientName: "Other" } },
        manifest: signed.manifest,
        signature: signed.signature,
      },
      "test-secret",
    ),
    false,
  );
});

test("generate proposal export stores proposal and compliance evidence", async () => {
  const templates: any[] = [];
  const proposals: any[] = [];
  const evidences: any[] = [];
  const installations = [{ id: "inst_1", instanceId: "demo-001", clientName: "Demo SA", domain: "demo.local" }];

  const prisma = {
    installation: {
      findUnique: async ({ where }: any) => {
        if (where?.id) return installations.find((i) => i.id === where.id) ?? null;
        return null;
      },
    },
    proposalTemplate: {
      upsert: async ({ where, create, update }: any) => {
        let row = templates.find((t) => t.key === where.key);
        if (!row) {
          row = {
            id: `tpl_${templates.length + 1}`,
            ...create,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          templates.push(row);
        } else {
          Object.assign(row, update, { updatedAt: new Date().toISOString() });
        }
        return row;
      },
      findUnique: async ({ where }: any) =>
        templates.find((t) => (where.id ? t.id === where.id : t.key === where.key)) ?? null,
      findMany: async () => templates,
    },
    proposalDocument: {
      create: async ({ data }: any) => {
        const row = { id: `prop_${proposals.length + 1}`, ...data, createdAt: new Date().toISOString() };
        proposals.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = proposals.find((p) => p.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    complianceEvidence: {
      create: async ({ data }: any) => {
        const row = { id: `ev_${evidences.length + 1}`, ...data };
        evidences.push(row);
        return row;
      },
    },
  };

  const result = await generateProposalExport(prisma as any, {
    installationId: "inst_1",
    planTier: "C1",
    clientName: "Demo SA",
    variables: {
      scope: "Scope",
      timeline: "2 weeks",
      costs: "Costs text",
      exclusions: "Exclusions text",
    },
    pricing: { currency: "USD", baseAmount: 1000, discountPct: 0 },
    actor: "cp:admin",
  });

  assert.equal(result.proposalId.startsWith("prop_"), true);
  assert.equal(Buffer.isBuffer(result.pdf), true);
  assert.equal(proposals.length, 1);
  assert.equal(evidences.length, 1);
  assert.equal(evidences[0].evidenceType, "proposal_builder.export");
});

