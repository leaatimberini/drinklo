import { EdiscoveryService } from "./ediscovery.service";
import { stableStringify, sha256 } from "../immutable-audit/immutable-audit.service";

function makePrisma() {
  return {
    order: { findMany: jest.fn().mockResolvedValue([{ id: "o1", createdAt: new Date("2026-01-01"), items: [], payments: [], statusEvents: [], taxBreakdown: null }]) },
    invoice: { findMany: jest.fn().mockResolvedValue([{ id: "i1", createdAt: new Date("2026-01-01") }]) },
    afipLog: { findMany: jest.fn().mockResolvedValue([{ id: "a1", createdAt: new Date("2026-01-01") }]) },
    immutableAuditLog: { findMany: jest.fn().mockResolvedValue([{ id: "l1", createdAt: new Date("2026-01-01"), companyId: "co1", category: "configuration", action: "PATCH /x", method: "PATCH", route: "/x", statusCode: 200, actorUserId: null, actorRole: null, aggregateType: null, aggregateId: null, aggregateVersion: null, payload: { a: 1 }, payloadHash: sha256(stableStringify({ a: 1 })), previousHash: null, chainHash: "c1" }]) },
    eventLog: { findMany: jest.fn().mockResolvedValue([{ id: "e1", payload: { n: 1 }, receivedAt: new Date("2026-01-01") }]) },
    companySettings: { findUnique: jest.fn().mockResolvedValue({ id: "s1", companyId: "co1", brandName: "Acme" }) },
    dataRetentionPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    sodPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    secretAudit: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: "u1", email: "a@a.com", name: "Admin", roleId: "r1", createdAt: new Date(), updatedAt: new Date(), deletedAt: null }]) },
    role: { findMany: jest.fn().mockResolvedValue([{ id: "r1", name: "admin" }]) },
    permission: { findMany: jest.fn().mockResolvedValue([{ id: "p1", code: "users:write" }]) },
    rolePermission: { findMany: jest.fn().mockResolvedValue([{ id: "rp1", roleId: "r1", permissionId: "p1" }]) },
    userBranch: { findMany: jest.fn().mockResolvedValue([]) },
    accessReviewCampaign: { findMany: jest.fn().mockResolvedValue([]) },
    legalHold: { findMany: jest.fn().mockResolvedValue([{ id: "h1", customerId: "c1", userId: null, status: "ACTIVE", entityScopes: ["ORDERS"], evidenceHash: "eh1", customer: null, user: null, createdBy: null, releasedBy: null }]) },
  } as any;
}

function makeAudit() {
  return {
    signEvidencePack: jest.fn((pack: any) => sha256(stableStringify(pack))),
    verifyChain: jest.fn().mockReturnValue({ ok: true, count: 1, tailHash: "c1" }),
  } as any;
}

describe("EdiscoveryService", () => {
  it("exports signed forensic pack and verifies integrity", async () => {
    const service = new EdiscoveryService(makePrisma(), makeAudit());
    const pack = await service.exportForensicPack("co1", { entities: ["orders", "audit", "legal_holds"] });

    expect(pack.signature).toBeTruthy();
    expect(pack.manifest.sections.length).toBe(3);
    expect(service.verifyForensicPack(pack).ok).toBe(true);
  });

  it("fails verification when data is tampered", async () => {
    const service = new EdiscoveryService(makePrisma(), makeAudit());
    const pack = await service.exportForensicPack("co1", { entities: ["orders"] });
    (pack.data as any).orders.items[0].id = "tampered";

    const verified = service.verifyForensicPack(pack);
    expect(verified.ok).toBe(false);
    expect((verified as any).reason).toBe("manifest_hash_mismatch");
  });
});

