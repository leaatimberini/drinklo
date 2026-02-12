import { ImmutableAuditService } from "./immutable-audit.service";

function makePrisma() {
  const store: any[] = [];
  return {
    store,
    prisma: {
      immutableAuditLog: {
        findFirst: jest.fn(async (args: any) => {
          const list = [...store];
          if (!list.length) return null;
          if (args?.where?.companyId && args?.where?.aggregateType && args?.where?.aggregateId) {
            const filtered = list
              .filter(
                (item) =>
                  item.companyId === args.where.companyId &&
                  item.aggregateType === args.where.aggregateType &&
                  item.aggregateId === args.where.aggregateId,
              )
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            return filtered[0] ?? null;
          }
          return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `a${store.length + 1}`,
            createdAt: new Date(Date.now() + store.length),
            ...data,
          };
          store.push(row);
          return row;
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return store.filter((item) => item.companyId === where.companyId);
        }),
      },
    },
  };
}

describe("ImmutableAuditService", () => {
  it("builds valid hash chain", async () => {
    const { prisma, store } = makePrisma();
    const service = new ImmutableAuditService(prisma as any);

    await service.append({
      companyId: "c1",
      category: "configuration",
      action: "PATCH /themes",
      method: "PATCH",
      route: "/themes",
      statusCode: 200,
      aggregateType: "config",
      aggregateId: "theme",
      payload: { adminTheme: "B" },
    });
    await service.append({
      companyId: "c1",
      category: "stock",
      action: "POST /stock/receive",
      method: "POST",
      route: "/stock/receive",
      statusCode: 200,
      aggregateType: "stock",
      aggregateId: "item-1",
      payload: { qty: 2 },
    });

    const verification = service.verifyChain(store as any);
    expect(verification.ok).toBe(true);
  });

  it("detects tampering in chain", async () => {
    const { prisma, store } = makePrisma();
    const service = new ImmutableAuditService(prisma as any);

    await service.append({
      companyId: "c1",
      category: "billing",
      action: "POST /billing/invoice",
      method: "POST",
      route: "/billing/invoice",
      statusCode: 200,
      aggregateType: "billing",
      aggregateId: "inv-1",
      payload: { total: 1000 },
    });
    await service.append({
      companyId: "c1",
      category: "pricing",
      action: "PATCH /admin/promos",
      method: "PATCH",
      route: "/admin/promos",
      statusCode: 200,
      aggregateType: "pricing",
      aggregateId: "promo-1",
      payload: { discount: 10 },
    });

    store[1].payload.discount = 99;
    const verification = service.verifyChain(store as any);
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe("payload_hash_mismatch");
  });

  it("exports signed evidence pack", async () => {
    process.env.AUDIT_EVIDENCE_SECRET = "audit-secret";
    const { prisma } = makePrisma();
    const service = new ImmutableAuditService(prisma as any);

    await service.append({
      companyId: "c1",
      category: "configuration",
      action: "POST /setup/initialize",
      method: "POST",
      route: "/setup/initialize",
      statusCode: 201,
      aggregateType: "config",
      aggregateId: "company",
      payload: { companyName: "ACME" },
    });

    const pack = await service.exportEvidencePack("c1", {});
    expect(pack.signature).toBeTruthy();
    const { signature, ...unsigned } = pack;
    const expected = service.signEvidencePack(unsigned);
    expect(signature).toBe(expected);
  });
});
