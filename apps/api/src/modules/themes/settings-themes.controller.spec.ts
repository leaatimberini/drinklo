import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PermissionsGuard } from "../common/permissions.guard";
import { ThemesService } from "./themes.service";
import { SettingsThemesController } from "./settings-themes.controller";
import { JwtStrategy } from "../auth/jwt.strategy";

describe("SettingsThemesController RBAC", () => {
  it("requires settings:write permission", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: "dev-secret",
        }),
      ],
      controllers: [SettingsThemesController],
      providers: [
        JwtStrategy,
        PermissionsGuard,
        {
          provide: ThemesService,
          useValue: {
            updateThemes: jest.fn().mockResolvedValue({
              admin: { id: "A" },
              storefront: { id: "B" },
            }),
          },
        },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const jwt = moduleRef.get(JwtService);
    const tokenWithoutPermission = await jwt.signAsync({
      sub: "user-1",
      companyId: "company-1",
      role: "marketing",
      permissions: ["products:read"],
    });
    const tokenWithPermission = await jwt.signAsync({
      sub: "user-1",
      companyId: "company-1",
      role: "admin",
      permissions: ["settings:write"],
    });

    const denied = await request(app.getHttpServer())
      .put("/settings/themes")
      .set("Authorization", `Bearer ${tokenWithoutPermission}`)
      .send({ adminTheme: "A", storefrontTheme: "B" });

    expect(denied.status).toBe(403);

    const allowed = await request(app.getHttpServer())
      .put("/settings/themes")
      .set("Authorization", `Bearer ${tokenWithPermission}`)
      .send({ adminTheme: "A", storefrontTheme: "B" });

    expect(allowed.status).toBe(200);

    await app.close();
  });
});
