import { ForbiddenException, HttpException, UnauthorizedException } from "@nestjs/common";
import { DeveloperApiService } from "./developer-api.service";

function buildService(overrides?: unknown) {
  const prisma = {
    developerApiKey: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    developerApiUsage: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    category: { findMany: jest.fn() },
    product: { count: jest.fn(), findMany: jest.fn() },
    priceList: { findMany: jest.fn() },
    priceRule: { findMany: jest.fn() },
    stockItem: { findMany: jest.fn() },
    developerWebhookEndpoint: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    developerWebhookDelivery: { create: jest.fn() },
    $transaction: jest.fn(),
    ...overrides,
  };
  const audit = { append: jest.fn() };
  return {
    prisma,
    audit,
    service: new DeveloperApiService(prisma as never as never, audit as never),
  };
}

describe("DeveloperApiService", () => {
  const baseKey = {
    id: "key-1",
    companyId: "company-1",
    keyPrefix: "dpk_test",
    keyHash: "",
    scopes: ["read:products", "read:categories"],
    rateLimitPerMin: 2,
    revokedAt: null,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.DEVELOPER_API_KEY_PEPPER = "test-pepper";
  });

  it("authenticates valid key", async () => {
    const { hashApiKeySecret } = await import("./developer-api.crypto");
    const secret = "valid-secret";
    const key = { ...baseKey, keyHash: hashApiKeySecret(secret) };

    const { service, prisma } = buildService();
    prisma.developerApiKey.findFirst.mockResolvedValue(key);
    prisma.developerApiKey.update.mockResolvedValue({});

    const ctx = await service.validateAndConsume({
      rawKey: `${key.keyPrefix}.${secret}`,
      route: "/developer/v1/products",
      method: "GET",
      requiredScopes: ["read:products"],
      ip: "10.10.10.10",
      userAgent: "jest",
    });

    expect(ctx.companyId).toBe("company-1");
    expect(ctx.keyId).toBe("key-1");
    expect(prisma.developerApiKey.update).toHaveBeenCalled();
  });

  it("rejects invalid key secret", async () => {
    const { hashApiKeySecret } = await import("./developer-api.crypto");
    const key = { ...baseKey, keyHash: hashApiKeySecret("different") };
    const { service, prisma } = buildService();
    prisma.developerApiKey.findFirst.mockResolvedValue(key);

    await expect(
      service.validateAndConsume({
        rawKey: `${key.keyPrefix}.wrong`,
        route: "/developer/v1/products",
        method: "GET",
        requiredScopes: ["read:products"],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("enforces scopes", async () => {
    const { hashApiKeySecret } = await import("./developer-api.crypto");
    const secret = "valid-secret";
    const key = { ...baseKey, keyHash: hashApiKeySecret(secret), scopes: ["read:categories"] };
    const { service, prisma } = buildService();
    prisma.developerApiKey.findFirst.mockResolvedValue(key);

    await expect(
      service.validateAndConsume({
        rawKey: `${key.keyPrefix}.${secret}`,
        route: "/developer/v1/products",
        method: "GET",
        requiredScopes: ["read:products"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.developerApiUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scopeDenied: true, statusCode: 403 }) }),
    );
  });

  it("applies rate limit by key and ip", async () => {
    const { hashApiKeySecret } = await import("./developer-api.crypto");
    const secret = "valid-secret";
    const key = { ...baseKey, keyHash: hashApiKeySecret(secret), rateLimitPerMin: 1 };
    const { service, prisma } = buildService();
    prisma.developerApiKey.findFirst.mockResolvedValue(key);
    prisma.developerApiKey.update.mockResolvedValue({});

    await service.validateAndConsume({
      rawKey: `${key.keyPrefix}.${secret}`,
      route: "/developer/v1/products",
      method: "GET",
      requiredScopes: ["read:products"],
      ip: "10.10.10.10",
    });

    await service
      .validateAndConsume({
        rawKey: `${key.keyPrefix}.${secret}`,
        route: "/developer/v1/products",
        method: "GET",
        requiredScopes: ["read:products"],
        ip: "10.10.10.10",
      })
      .then(
        () => {
          throw new Error("expected rate limit error");
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(HttpException);
          expect((error as HttpException).getStatus()).toBe(429);
        },
      );

    expect(prisma.developerApiUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rateLimited: true, statusCode: 429 }) }),
    );
  });
});
