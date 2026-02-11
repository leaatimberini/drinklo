import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers["x-request-id"] as string) || "";
  const requestId = incoming || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
