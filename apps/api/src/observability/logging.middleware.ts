import { Request, Response, NextFunction } from "express";
import { addRequestLog } from "../modules/ops/log-store";

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = {
      level: "info",
      msg: "request",
      requestId: (req as unknown).requestId,
      userId: (req as unknown).user?.sub,
      companyId: (req as unknown).user?.companyId,
      route: req.originalUrl,
      method: req.method,
      status: res.statusCode,
      durationMs: duration,
    };
    addRequestLog(log);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(log));
  });
  next();
}
