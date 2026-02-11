import { SetMetadata } from "@nestjs/common";
import type { RoleName } from "./rbac.constants";

export const ROLES_KEY = "roles";
export const PERMISSIONS_KEY = "permissions";

export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
