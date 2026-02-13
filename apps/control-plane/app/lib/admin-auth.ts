import type { NextRequest } from "next/server";
import { getTokenForRole, isRoleAllowed, type Role } from "./auth";

export function isAdminHeaderAuthorized(req: NextRequest) {
  const headerToken = req.headers.get("x-cp-admin-token");
  return Boolean(headerToken && headerToken === process.env.CONTROL_PLANE_ADMIN_TOKEN);
}

export function isAdminRequest(req: NextRequest) {
  if (isAdminHeaderAuthorized(req)) {
    return true;
  }

  const role = req.cookies.get("cp_role")?.value as Role | undefined;
  const token = req.cookies.get("cp_token")?.value;
  if (!role || !token) return false;
  const expected = getTokenForRole(role);
  return token === expected && isRoleAllowed(role, ["admin"]);
}
