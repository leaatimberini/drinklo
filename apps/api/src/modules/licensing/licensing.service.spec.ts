import { LicensingService } from "./licensing.service";
import type { LicensePayload } from "./license.types";

const makeService = (license: unknown = null) => {
  const prisma = {
    licenseKey: {
      findUnique: jest.fn().mockResolvedValue(license),
      upsert: jest.fn().mockResolvedValue({}),
    },
  } as unknown;

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
    const allowed = await service.isFeatureEnabled("c1", "andreani" as unknown);
    expect(allowed).toBe(false);
  });

  it("keeps basic sales and blocks premium in soft/hard limits", async () => {
    const almostExpired = {
      companyId: "c1",
      key: "k",
      plan: "pro",
      expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      features: ["afip"],
    };
    const { service } = makeService(almostExpired);
    const soft = await service.getEnforcement("c1", "andreani" as unknown);
    expect(soft.stage).toBe("soft_limit");
    expect(soft.basicSalesAllowed).toBe(true);
    expect(soft.premiumBlocked).toBe(true);

    const longExpired = {
      ...almostExpired,
      expiresAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    };
    const { service: service2 } = makeService(longExpired);
    const hard = await service2.getEnforcement("c1", "andreani" as unknown);
    expect(hard.stage).toBe("hard_limit");
    expect(hard.basicSalesAllowed).toBe(true);
    expect(hard.premiumBlocked).toBe(true);
  });
});
