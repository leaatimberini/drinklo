import assert from "node:assert/strict";
import test from "node:test";
import { issueAcademyCertificate, trackAcademyProgress } from "./academy";

function createMockPrisma() {
  const installation = { id: "inst-db-1", instanceId: "inst-1", clientName: "Demo" };
  const progresses: any[] = [];
  const certificates: any[] = [];
  const evidence: any[] = [];

  const prisma = {
    installation: {
      async findUnique({ where }: any) {
        if (where?.id && where.id === installation.id) return installation;
        if (where?.instanceId && where.instanceId === installation.instanceId) return installation;
        return null;
      },
    },
    academyProgress: {
      async findUnique({ where }: any) {
        const key = where.instanceId_learnerKey_courseKey;
        return (
          progresses.find(
            (row) => row.instanceId === key.instanceId && row.learnerKey === key.learnerKey && row.courseKey === key.courseKey,
          ) ?? null
        );
      },
      async upsert({ where, create, update }: any) {
        const key = where.instanceId_learnerKey_courseKey;
        const idx = progresses.findIndex(
          (row) => row.instanceId === key.instanceId && row.learnerKey === key.learnerKey && row.courseKey === key.courseKey,
        );
        if (idx >= 0) {
          progresses[idx] = { ...progresses[idx], ...update, updatedAt: new Date() };
          return progresses[idx];
        }
        const row = {
          id: `prog-${progresses.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
          certificates: [],
        };
        progresses.push(row);
        return row;
      },
      async update({ where, data }: any) {
        const idx = progresses.findIndex((row) => row.id === where.id);
        if (idx < 0) throw new Error("progress_not_found");
        progresses[idx] = { ...progresses[idx], ...data, updatedAt: new Date() };
        return progresses[idx];
      },
      async findMany() {
        return progresses.map((row) => ({ ...row, installation, certificates: certificates.filter((c) => c.progressId === row.id).slice(-1) }));
      },
    },
    academyCertificate: {
      async findFirst({ where }: any) {
        return (
          certificates
            .filter(
              (row) =>
                row.instanceId === where.instanceId &&
                row.learnerKey === where.learnerKey &&
                row.courseKey === where.courseKey &&
                row.certificateType === where.certificateType,
            )
            .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt))[0] ?? null
        );
      },
      async create({ data }: any) {
        const row = { id: `cert-${certificates.length + 1}`, createdAt: new Date(), ...data };
        certificates.push(row);
        return row;
      },
      async update({ where, data }: any) {
        const idx = certificates.findIndex((row) => row.id === where.id);
        if (idx < 0) throw new Error("cert_not_found");
        certificates[idx] = { ...certificates[idx], ...data };
        return certificates[idx];
      },
    },
    complianceEvidence: {
      async create({ data }: any) {
        evidence.push(data);
        return { id: `evi-${evidence.length}`, ...data };
      },
    },
    __state: { progresses, certificates, evidence },
  };

  return prisma as any;
}

test("tracks academy progress deterministically and marks completed after quiz pass", async () => {
  const prisma = createMockPrisma();

  await trackAcademyProgress(prisma, {
    instanceId: "inst-1",
    learnerKey: "admin@demo.com",
    learnerEmail: "admin@demo.com",
    learnerName: "Admin",
    courseKey: "kiosco-fast-start",
    action: "module_complete",
    moduleKey: "catalogo-express",
    locale: "es-AR",
    icp: "kiosco",
  });

  await trackAcademyProgress(prisma, {
    instanceId: "inst-1",
    learnerKey: "admin@demo.com",
    courseKey: "kiosco-fast-start",
    action: "quiz_submit",
    moduleKey: "cobros-mp",
    quizAnswers: [0, 0],
    locale: "es",
    icp: "kiosco",
  });

  const finalState = await trackAcademyProgress(prisma, {
    instanceId: "inst-1",
    learnerKey: "admin@demo.com",
    courseKey: "kiosco-fast-start",
    action: "module_complete",
    moduleKey: "primera-venta-pos",
    locale: "es",
    icp: "kiosco",
  });

  assert.equal(finalState.summary.completed, true);
  assert.equal(finalState.progress.status, "COMPLETED");
  assert.equal(finalState.progress.progressPct, 100);
  assert.equal((finalState.progress.completedModuleKeys ?? []).length, 3);
});

test("issues academy certificate with evidence hash and signature", async () => {
  const prisma = createMockPrisma();

  await trackAcademyProgress(prisma, {
    instanceId: "inst-1",
    learnerKey: "admin@demo.com",
    learnerEmail: "admin@demo.com",
    learnerName: "Admin",
    courseKey: "distribuidora-operaciones",
    action: "module_complete",
    moduleKey: "listas-mayoristas",
    locale: "es",
    icp: "distribuidora",
  });
  await trackAcademyProgress(prisma, {
    instanceId: "inst-1",
    learnerKey: "admin@demo.com",
    courseKey: "distribuidora-operaciones",
    action: "module_complete",
    moduleKey: "reparto-andreani",
    locale: "es",
    icp: "distribuidora",
  });
  await trackAcademyProgress(prisma, {
    instanceId: "inst-1",
    learnerKey: "admin@demo.com",
    courseKey: "distribuidora-operaciones",
    action: "quiz_submit",
    moduleKey: "quiz-mayorista",
    quizAnswers: [0],
    locale: "es",
    icp: "distribuidora",
  });

  const issued = await issueAcademyCertificate(prisma, {
    instanceId: "inst-1",
    courseKey: "distribuidora-operaciones",
    learnerKey: "admin@demo.com",
    actor: "cp:admin",
  });

  assert.ok(issued.certificate.id);
  assert.match(issued.evidence.evidenceHash, /^[a-f0-9]{64}$/);
  assert.match(issued.evidence.evidenceSignature, /^[a-f0-9]{64}$/);
  assert.equal(prisma.__state.certificates.length, 1);
  assert.equal(prisma.__state.evidence.length, 1);
  assert.equal(prisma.__state.progresses[0].status, "CERTIFIED");
});

