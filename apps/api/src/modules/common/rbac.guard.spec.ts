import { PermissionsGuard } from "./permissions.guard";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY, PERMISSIONS_KEY } from "./rbac.decorators";
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

  it("denies when permission missing", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["users:write"] as any);
    const guard = new PermissionsGuard(reflector);
    const ctx = makeContext({ permissions: ["users:read"] });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("allows when permission present", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["users:write"] as any);
    const guard = new PermissionsGuard(reflector);
    const ctx = makeContext({ permissions: ["users:write", "users:read"] });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
