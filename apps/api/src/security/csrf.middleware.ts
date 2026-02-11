import { Request, Response, NextFunction } from "express";

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return next();
  }

  if (!req.originalUrl.startsWith("/admin")) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"] as string | undefined;
  const cookie = req.headers.cookie ?? "";
  const match = cookie.match(/csrf_token=([^;]+)/);
  const cookieToken = match ? match[1] : undefined;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    res.status(403).json({ message: "CSRF validation failed" });
    return;
  }

  next();
}
