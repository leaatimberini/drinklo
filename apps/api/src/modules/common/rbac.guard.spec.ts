import { PermissionsGuard } from "./permissions.guard";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY, PERMISSIONS_KEY, SOD_ACTION_KEY } from "./rbac.decorators";
import { Reflector } from "@nestjs/core";

function makeContext(user: any) {
  return {
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe("RBAC Guards", () => {
  it("denies when role not allowed", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"] as any);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ role: "manager" });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("allows when role allowed", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"] as any);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ role: "admin" });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("denies when permission missing", async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["users:write"] as any);
    const guard = new PermissionsGuard(reflector);
    const ctx = makeContext({ permissions: ["users:read"] });
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });

  it("allows when permission present", async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["users:write"] as any);
    const guard = new PermissionsGuard(reflector);
    const ctx = makeContext({ permissions: ["users:write", "users:read"] });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("denies when SoD service blocks action", async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key: any) => {
      if (key === PERMISSIONS_KEY) return ["pricing:write"] as any;
      if (key === SOD_ACTION_KEY) return "PRICING_CONFIGURE" as any;
      return undefined as any;
    });
    const sod = {
      evaluateAndRecord: jest.fn().mockResolvedValue({ allowed: false, violations: [{}] }),
    } as any;
    const guard = new PermissionsGuard(reflector, sod);
    const ctx = makeContext({
      sub: "u1",
      companyId: "co1",
      permissions: ["pricing:write"],
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
    expect(sod.evaluateAndRecord).toHaveBeenCalled();
  });
});
