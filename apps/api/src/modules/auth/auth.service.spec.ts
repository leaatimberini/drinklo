import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

const prismaMock = {
  user: {
    findFirst: jest.fn(),
  },
  companyIamConfig: {
    findUnique: jest.fn(),
  },
  userMfaConfig: {
    findUnique: jest.fn(),
  },
};

const jwtMock = {
  signAsync: jest.fn(),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    prismaMock.user.findFirst.mockReset();
    prismaMock.companyIamConfig.findUnique.mockReset();
    prismaMock.userMfaConfig.findUnique.mockReset();
    jwtMock.signAsync.mockReset();
    prismaMock.companyIamConfig.findUnique.mockResolvedValue(null);
  });

  it("logs in with valid credentials", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      email: "admin@acme.local",
      name: "Admin",
      passwordHash: "admin123",
      role: { name: "Admin" },
      deletedAt: null,
    });
    jwtMock.signAsync.mockResolvedValue("token");

    const result = await service.login("admin@acme.local", "admin123");

    expect(result.accessToken).toBe("token");
    expect(result.user.role).toBe("admin");
  });

  it("rejects invalid credentials", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      email: "admin@acme.local",
      name: "Admin",
      passwordHash: "admin123",
      role: { name: "Admin" },
      deletedAt: null,
    });

    await expect(service.login("admin@acme.local", "wrong")).rejects.toThrow("Invalid credentials");
  });
});
