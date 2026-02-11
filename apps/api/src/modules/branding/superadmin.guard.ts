import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = req.headers["x-superadmin-token"] as string | undefined;
    const expected = process.env.SUPERADMIN_TOKEN;
    const ip = req.ip ?? req.connection?.remoteAddress ?? "";
    const isLocal = ip.includes("127.0.0.1") || ip.includes("::1");
    if (!expected || !token) return false;
    return isLocal && token === expected;
  }
}
