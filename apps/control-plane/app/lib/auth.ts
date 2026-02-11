export type Role = "support" | "ops" | "admin";

export function getTokenForRole(role: Role) {
  if (role === "admin") return process.env.CONTROL_PLANE_ADMIN_TOKEN;
  if (role === "ops") return process.env.CONTROL_PLANE_OPS_TOKEN;
  return process.env.CONTROL_PLANE_SUPPORT_TOKEN;
}

export function isRoleAllowed(role: Role, required: Role[]) {
  if (role === "admin") return true;
  return required.includes(role);
}
