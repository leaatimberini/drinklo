import { LicensingService } from "./licensing.service";
import type { LicensePayload } from "./license.types";

const makeService = (license: any = null) => {
  const prisma = {
    licenseKey: {
      findUnique: jest.fn().mockResolvedValue(license),
      upsert: jest.fn().mockResolvedValue({}),
    },
  } as any;

  return { service: new LicensingService(prisma), prisma };
};

describe("LicensingService", () => {
  const secret = "test-secret";
  const payload: LicensePayload = {
    companyId: "c1",
    plan: "pro",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    features: ["afip", "andreani"],
    issuedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    process.env.LICENSE_SECRET = secret;
    delete process.env.LICENSE_SERVER_URL;
  });

  it("detects expiration", async () => {
    const expired = {
      companyId: "c1",
      key: "k",
      plan: "pro",
      expiresAt: new Date(Date.now() - 1000),
      features: ["afip"],
    };
    const { service } = makeService(expired);
    const status = await service.getStatus("c1");
    expect(status.valid).toBe(false);
    expect(status.reason).toBe("expired");
  });

  it("generates and applies key", async () => {
    const { service, prisma } = makeService(null);
    const key = service.generateKey(payload, secret);
    await service.apply("c1", key);
    expect(prisma.licenseKey.upsert).toHaveBeenCalled();
  });

  it("gates missing feature", async () => {
    const license = {
      companyId: "c1",
      key: "k",
      plan: "pro",
      expiresAt: new Date(Date.now() + 10000),
      features: ["afip"],
    };
    const { service } = makeService(license);
    const allowed = await service.isFeatureEnabled("c1", "andreani" as any);
    expect(allowed).toBe(false);
  });
});
