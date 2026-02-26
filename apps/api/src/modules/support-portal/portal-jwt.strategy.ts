import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, "portal-jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.SUPPORT_PORTAL_JWT_SECRET ?? "dev-portal-secret",
    });
  }

  validate(payload: unknown) {
    return payload;
  }
}
