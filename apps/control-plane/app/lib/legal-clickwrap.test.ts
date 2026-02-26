import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLegalAcceptanceEvidencePack,
  recordLegalAcceptances,
  validateSignupClickwrap,
} from "./legal-clickwrap";

type LegalDocRow = {
  id: string;
  type: "TOS" | "PRIVACY" | "DPA" | "SLA";
  version: string;
  locale: string;
  title: string;
  content: string;
  contentHash: string;
  effectiveAt: Date;
  createdAt: Date;
};

function fakePrismaForLegalDocs(seedDocs: LegalDocRow[]) {
  const docs = [...seedDocs];
  const acceptances: any[] = [];
  const evidence: any[] = [];

  return {
    _state: { docs, acceptances, evidence },
    legalDocument: {
      async upsert({ where, create, update }: any) {
        const idx = docs.findIndex(
          (d) =>
            d.type === where.type_version_locale.type &&
            d.version === where.type_version_locale.version &&
            d.locale === where.type_version_locale.locale,
        );
        if (idx >= 0) {
          docs[idx] = { ...docs[idx], ...update };
          return docs[idx];
        }
        const row = {
          id: `doc-${docs.length + 1}`,
          createdAt: new Date(),
          ...create,
        };
        docs.push(row);
        return row;
      },
      async findMany({ where, orderBy: _orderBy }: any) {
        let rows = docs.filter((d) => (!where.type?.in ? true : where.type.in.includes(d.type)));
        if (where.locale) rows = rows.filter((d) => d.locale === where.locale);
        if (where.effectiveAt?.lte) rows = rows.filter((d) => d.effectiveAt <= where.effectiveAt.lte);
        rows = rows.sort((a, b) => {
          const eff = b.effectiveAt.getTime() - a.effectiveAt.getTime();
          if (eff !== 0) return eff;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        return rows;
      },
    },
    legalAcceptance: {
      async create({ data }: any) {
        const row = { id: `acc-${acceptances.length + 1}`, createdAt: new Date(), ...data };
        acceptances.push(row);
        return row;
      },
      async findMany({ where }: any) {
        if (where?.OR && Array.isArray(where.OR)) {
          return acceptances.filter((a) =>
            where.OR.some((cond: any) => {
              if (cond.installation?.instanceId) return cond.installation.instanceId === "inst-demo" && a.installationId === "install-1";
              if (cond.billingAccount?.instanceId) return cond.billingAccount.instanceId === "inst-demo" && a.billingAccountId === "ba-1";
              return false;
            }),
          );
        }
        return acceptances;
      },
    },
    installation: {
      async findUnique({ where }: any) {
        if (where.instanceId !== "inst-demo") return null;
        return { id: "install-1", instanceId: "inst-demo", clientName: "Demo", domain: "demo.test" };
      },
    },
    billingAccount: {
      async findUnique({ where }: any) {
        if (where.instanceId !== "inst-demo") return null;
        return { id: "ba-1", instanceId: "inst-demo", clientName: "Demo", plan: { name: "C3" } };
      },
    },
    complianceEvidence: {
      async create({ data }: any) {
        evidence.push(data);
        return { id: `ev-${evidence.length}`, ...data };
      },
    },
  };
}

test("clickwrap requires TOS and Privacy acceptance", async () => {
  const prisma = fakePrismaForLegalDocs([]);
  await assert.rejects(
    () =>
      validateSignupClickwrap(prisma as any, {
        acceptTos: true,
        acceptPrivacy: false,
        locale: "es",
      }),
    /legal_acceptance_required/,
  );
});

test("clickwrap stores latest legal document version", async () => {
  const prisma = fakePrismaForLegalDocs([
    {
      id: "tos-v1",
      type: "TOS",
      version: "v1",
      locale: "es",
      title: "TOS v1",
      content: "old",
      contentHash: "h1",
      effectiveAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: "tos-v2",
      type: "TOS",
      version: "v2",
      locale: "es",
      title: "TOS v2",
      content: "new",
      contentHash: "h2",
      effectiveAt: new Date("2026-02-01T00:00:00Z"),
      createdAt: new Date("2026-02-01T00:00:00Z"),
    },
    {
      id: "priv-v1",
      type: "PRIVACY",
      version: "v1",
      locale: "es",
      title: "Privacy v1",
      content: "privacy",
      contentHash: "hp",
      effectiveAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  ]);

  const validated = await validateSignupClickwrap(
    prisma as any,
    { acceptTos: true, acceptPrivacy: true, locale: "es" },
    new Date("2026-02-10T00:00:00Z"),
  );
  const result = await recordLegalAcceptances(prisma as any, {
    documents: validated.documents.map((d) => ({ id: d.id, type: d.type, version: d.version, locale: d.locale })),
    installationId: "install-1",
    billingAccountId: "ba-1",
    userId: "owner@test.com",
    source: "trial_signup",
  });

  assert.equal(result.count, 2);
  const tosAcceptance = prisma._state.acceptances.find((a: any) => a.docType === "TOS");
  assert.equal(tosAcceptance.version, "v2");
});

test("legal acceptance evidence pack is signed and persisted", async () => {
  const prisma = fakePrismaForLegalDocs([
    {
      id: "tos-v1",
      type: "TOS",
      version: "v1",
      locale: "es",
      title: "TOS v1",
      content: "old",
      contentHash: "h1",
      effectiveAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  ]);
  await recordLegalAcceptances(prisma as any, {
    documents: [{ id: "tos-v1", type: "TOS", version: "v1", locale: "es" }],
    installationId: "install-1",
    billingAccountId: "ba-1",
    userId: "admin@demo.test",
    source: "enterprise_admin_clickwrap",
  });

  const pack = await buildLegalAcceptanceEvidencePack(prisma as any, { instanceId: "inst-demo", actor: "cp:admin" });
  assert.equal(pack.filename.includes("inst-demo"), true);
  assert.equal(typeof pack.manifest.signature, "string");
  assert.equal(pack.manifest.signature.length > 10, true);
  assert.equal(prisma._state.evidence.length, 1);
});
