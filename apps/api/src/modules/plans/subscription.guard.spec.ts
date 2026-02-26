import { HttpException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { SubscriptionGuard } from "./subscription.guard";

function fakeJwt(payload: unknown) {
  const base64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.sig`;
}

function makeContext(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getClass: () => ({} as never),
    getHandler: () => ({} as never),
  };
}

describe("SubscriptionGuard", () => {
  function makeGuard(overrides?: Partial<{ status: string; variant: string }>) {
    const status = overrides?.status ?? "RESTRICTED";
    const variant = overrides?.variant ?? "CATALOG_ONLY";
    const prisma = {
      subscription: {
        findUnique: jest.fn(async () => ({ status })),
      },
      companySettings: {
        findUnique: jest.fn(async () => ({ restrictedModeVariant: variant })),
      },
      company: {
        findFirst: jest.fn(async () => ({ id: "company-1" })),
      },
      developerApiKey: {
        findFirst: jest.fn(async () => ({ companyId: "company-1" })),
      },
    };
    const audit = {
      append: jest.fn(async () => ({ id: "audit-1" })),
    };
    const guard = new SubscriptionGuard(prisma, audit);
    return { guard, prisma, audit };
  }

  it("blocks write endpoint for admin in RESTRICTED", async () => {
    const { guard, audit } = makeGuard({ variant: "ALLOW_BASIC_SALES" });
    const req = {
      method: "POST",
      baseUrl: "",
      route: { path: "/customers" },
      headers: {
        authorization: `Bearer ${fakeJwt({ sub: "u1", role: "admin", companyId: "company-1" })}`,
      },
      ip: "10.0.0.1",
    };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(HttpException);
    expect(audit.append).toHaveBeenCalledTimes(1);
  });

  it("allows storefront checkout write in RESTRICTED when variant allow-basic-sales", async () => {
    const { guard } = makeGuard({ variant: "ALLOW_BASIC_SALES" });
    const req = {
      method: "POST",
      route: { path: "/checkout/orders" },
      headers: {},
      ip: "10.0.0.1",
    };
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
  });

  it("blocks storefront checkout write in catalog-only variant", async () => {
    const { guard } = makeGuard({ variant: "CATALOG_ONLY" });
    const req = {
      method: "POST",
      route: { path: "/checkout/orders" },
      headers: {},
      ip: "10.0.0.1",
    };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(HttpException);
  });

  it("blocks developer api write and applies hard rate limit on reads", async () => {
    const { guard } = makeGuard({ variant: "ALLOW_BASIC_SALES" });
    const writeReq = {
      method: "POST",
      route: { path: "/developer/v1/products" },
      headers: { "x-api-key": "pref.secret" },
      ip: "10.0.0.2",
    };
    await expect(guard.canActivate(makeContext(writeReq))).rejects.toBeInstanceOf(HttpException);

    const readReq = {
      method: "GET",
      route: { path: "/developer/v1/products" },
      headers: { "x-api-key": "pref.secret" },
      ip: "10.0.0.3",
    };
    for (let i = 0; i < 30; i += 1) {
      await expect(guard.canActivate(makeContext(readReq))).resolves.toBe(true);
    }
    await expect(guard.canActivate(makeContext(readReq))).rejects.toBeInstanceOf(HttpException);
  });
});

