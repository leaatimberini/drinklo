import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { tap } from "rxjs/operators";
import { ImmutableAuditService } from "./immutable-audit.service";

@Injectable()
export class ImmutableAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: ImmutableAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap((data) => {
        const statusCode = Number(res?.statusCode ?? 200);
        this.audit.recordCriticalFromRequest(req, data, statusCode).catch(() => undefined);
      }),
    );
  }
}
