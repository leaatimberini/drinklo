import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DEVELOPER_API_SCOPES_KEY } from "./scopes.decorator";
import { DeveloperApiService } from "./developer-api.service";

function getApiKeyFromRequest(request: any) {
  const header = request.headers?.["x-api-key"] ?? request.headers?.["X-API-Key"];
  if (header) {
    return String(header).trim();
  }

  const authHeader = request.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

@Injectable()
export class DeveloperApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly developerApi: DeveloperApiService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(DEVELOPER_API_SCOPES_KEY, [context.getHandler(), context.getClass()]) ?? [];

    const rawKey = getApiKeyFromRequest(request);
    if (!rawKey) {
      throw new UnauthorizedException("Missing API key");
    }

    const path = String(request.route?.path ?? request.url ?? "");
    const method = String(request.method ?? "GET").toUpperCase();
    const result = await this.developerApi.validateAndConsume({
      rawKey,
      route: path,
      method,
      ip: request.ip,
      userAgent: request.headers?.["user-agent"],
      requiredScopes,
    });

    request.developerApi = result;
    return true;
  }
}
