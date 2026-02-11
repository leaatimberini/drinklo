import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getTokenForRole, isRoleAllowed, type Role } from "./auth";

export function isAdminRequest(req: NextRequest) {
  const headerToken = req.headers.get("x-cp-admin-token");
  if (headerToken && headerToken === process.env.CONTROL_PLANE_ADMIN_TOKEN) {
    return true;
  }

  const store = cookies();
  const role = store.get("cp_role")?.value as Role | undefined;
  const token = store.get("cp_token")?.value;
  if (!role || !token) return false;
  const expected = getTokenForRole(role);
  return token === expected && isRoleAllowed(role, ["admin"]);
}
