import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const start = process.hrtime.bigint();

    const method = req?.method ?? "UNKNOWN";
    const route =
      req?.route?.path ??
      (typeof req?.url === "string" ? req.url.split("?")[0] : "unknown");

    return next.handle().pipe(
      tap(() => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const status = res?.statusCode ?? 200;
        this.metrics.recordHttpRequest(method, route, status, durationMs);
      }),
      catchError((err) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const status = err?.status ?? err?.statusCode ?? 500;
        this.metrics.recordHttpRequest(method, route, status, durationMs);
        throw err;
      }),
    );
  }
}
