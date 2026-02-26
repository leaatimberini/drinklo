import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { OpsService } from "../modules/ops/ops.service";
import { Sentry } from "./sentry";
import { redactDeep } from "../modules/data-governance/dlp-redactor";

@Catch()
export class ObservabilityExceptionFilter implements ExceptionFilter {
  constructor(private readonly ops: OpsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const status = exception?.getStatus?.() ?? 500;

    const errorEntry = {
      id: (req as unknown)?.requestId ?? String(Date.now()),
      at: new Date().toISOString(),
      route: req?.originalUrl,
      message: redactDeep(exception?.message ?? "error"),
      stack: redactDeep(exception?.stack),
      requestId: (req as unknown)?.requestId,
      userId: (req as unknown)?.user?.sub,
      companyId: (req as unknown)?.user?.companyId,
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
      requestId: (req as unknown)?.requestId,
    };

    res.status(status).json(payload);
  }
}
