import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { OpsService } from "../modules/ops/ops.service";
import { Sentry } from "./sentry";

@Catch()
export class ObservabilityExceptionFilter implements ExceptionFilter {
  constructor(private readonly ops: OpsService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const status = exception?.getStatus?.() ?? 500;

    const errorEntry = {
      id: (req as any)?.requestId ?? String(Date.now()),
      at: new Date().toISOString(),
      route: req?.originalUrl,
      message: exception?.message ?? "error",
      stack: exception?.stack,
      requestId: (req as any)?.requestId,
      userId: (req as any)?.user?.sub,
      companyId: (req as any)?.user?.companyId,
    };

    this.ops.addError(errorEntry);

    try {
      Sentry.captureException(exception);
    } catch {
      // ignore
    }

    const payload = {
      statusCode: status,
      message: exception?.message ?? "Internal error",
      requestId: (req as any)?.requestId,
    };

    res.status(status).json(payload);
  }
}
