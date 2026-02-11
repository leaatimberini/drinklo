import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PortalController } from "./portal.controller";
import { PortalAuthService } from "./portal-auth.service";
import { PortalJwtStrategy } from "./portal-jwt.strategy";
import { PortalService } from "./portal.service";
import { StorageModule } from "../storage/storage.module";
import { OpsModule } from "../ops/ops.module";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SUPPORT_PORTAL_JWT_SECRET ?? "dev-portal-secret",
      signOptions: { expiresIn: "7d" },
    }),
    StorageModule,
    OpsModule,
  ],
  controllers: [PortalController],
  providers: [PortalAuthService, PortalJwtStrategy, PortalService],
})
export class PortalModule {}
