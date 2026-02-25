import { CanActivate, ExecutionContext, Injectable, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY, SOD_ACTION_KEY } from "./rbac.decorators";
import { SodAccessReviewsService } from "../sod-access-reviews/sod-access-reviews.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly sod?: SodAccessReviewsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const user = request.user as { sub?: string; companyId?: string; permissions?: string[] } | undefined;
    const permissions = user?.permissions ?? [];

    if (requiredPermissions?.length) {
      const hasPermissions = requiredPermissions.every((permission) => permissions.includes(permission));
      if (!hasPermissions) {
        return false;
      }
    }

    const sodAction = this.reflector.getAllAndOverride<string>(SOD_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (this.sod && sodAction && user?.companyId) {
      const routePath =
        request?.route?.path ?? request?.originalUrl ?? request?.url ?? undefined;
      const verdict = await this.sod.evaluateAndRecord({
        companyId: user.companyId,
        userId: user.sub,
        permissions,
        requestAction: sodAction,
        route: routePath,
        method: request?.method,
      });
      return verdict.allowed;
    }

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    return true;
  }
}
