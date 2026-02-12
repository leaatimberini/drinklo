import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";
import { DeveloperApiService } from "./developer-api.service";

@Injectable()
export class DeveloperApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly developerApi: DeveloperApiService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const ctx = request.developerApi as
      | {
          companyId: string;
          keyId: string;
          route: string;
          method: string;
          ipMasked?: string | null;
          userAgent?: string;
        }
      | undefined;

    return next.handle().pipe(
      tap(() => {
        if (!ctx) return;
        void this.developerApi.logUsage({
          companyId: ctx.companyId,
          keyId: ctx.keyId,
          route: ctx.route,
          method: ctx.method,
          statusCode: Number(response.statusCode ?? 200),
          ipMasked: ctx.ipMasked,
          userAgent: ctx.userAgent,
        });
      }),
      catchError((error) => {
        if (ctx) {
          const statusCode = Number(error?.status ?? error?.statusCode ?? 500);
          void this.developerApi.logUsage({
            companyId: ctx.companyId,
            keyId: ctx.keyId,
            route: ctx.route,
            method: ctx.method,
            statusCode,
            ipMasked: ctx.ipMasked,
            userAgent: ctx.userAgent,
          });
        }
        return throwError(() => error);
      }),
    );
  }
}
