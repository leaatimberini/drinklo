import { buildSingleFileZip, hashEvidencePayload, stableStringify } from "./compliance-evidence";
import { isAdminHeaderAuthorized } from "./admin-auth";

describe("ComplianceEvidence", () => {
  it("hashes payload deterministically", () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(hashEvidencePayload(a)).toBe(hashEvidencePayload(b));
  });

  it("creates signed export zip buffer with zip magic", () => {
    const zip = buildSingleFileZip("audit-package.json", Buffer.from("{}", "utf8"));
    expect(zip.length).toBeGreaterThan(20);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  });

  it("validates admin permission from header token", () => {
    process.env.CONTROL_PLANE_ADMIN_TOKEN = "test-admin-token";
    const authorizedReq = {
      headers: {
        get: (key: string) => (key === "x-cp-admin-token" ? "test-admin-token" : null),
      },
    } as any;

    const unauthorizedReq = {
      headers: {
        get: () => null,
      },
    } as any;

    expect(isAdminHeaderAuthorized(authorizedReq)).toBe(true);
    expect(isAdminHeaderAuthorized(unauthorizedReq)).toBe(false);
  });
});
