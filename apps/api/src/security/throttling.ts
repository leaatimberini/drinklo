import { ThrottlerGuard, ThrottlerModuleOptions } from "@nestjs/throttler";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): string {
    const ip = req.ip ?? req.headers["x-forwarded-for"] ?? "unknown";
    const auth = (req.headers["authorization"] as string) ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return token ? `${ip}:${token}` : String(ip);
  }
}

export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60_000,
      limit: 120,
    },
  ],
};
