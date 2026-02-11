export type RoleName = "admin" | "manager" | "caja" | "deposito" | "marketing" | "support";

export const RolePermissions: Record<RoleName, string[]> = {
  admin: [
    "products:read",
    "products:write",
    "pricing:read",
    "pricing:write",
    "inventory:read",
    "inventory:write",
    "users:read",
    "users:write",
    "customers:read",
    "customers:write",
    "settings:write",
  ],
  manager: [
    "products:read",
    "products:write",
    "pricing:read",
    "pricing:write",
    "inventory:read",
    "inventory:write",
    "customers:read",
    "customers:write",
    "users:read",
    "settings:write",
  ],
  caja: ["products:read", "pricing:read", "customers:read"],
  deposito: ["products:read", "inventory:read", "inventory:write"],
  marketing: ["products:read", "pricing:read", "customers:read"],
  support: ["products:read", "customers:read", "inventory:read", "settings:write"],
};
