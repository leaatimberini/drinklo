import { generateTotp, IamService } from "./iam.service";

describe("IamService", () => {
  const prisma: any = {
    companyIamConfig: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    userMfaConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
    scimProvisionLog: {
      create: jest.fn(),
    },
  };

  let service: IamService;

  beforeEach(() => {
    service = new IamService(prisma);
    Object.values(prisma).forEach((obj: any) => {
      Object.values(obj).forEach((fn: any) => fn.mockReset?.());
    });
  });

  it("supports mock SSO login", async () => {
    prisma.companyIamConfig.findFirst.mockResolvedValue({ companyId: "c1", ssoEnabled: true, ssoProtocol: "OIDC" });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findFirst.mockResolvedValue({ id: "r1" });
    prisma.user.create.mockResolvedValue({
      id: "u1",
      companyId: "c1",
      email: "admin@acme.test",
      name: "Admin",
      role: { name: "admin" },
    });

    const user = await service.authenticateSsoMock("OIDC", "mock:admin@acme.test:Admin");
    expect(user.email).toBe("admin@acme.test");
  });

  it("enables MFA after correct code", async () => {
    const setup = await service.setupMfa("u1", "u1@example.com");
    expect(setup.secret).toBeTruthy();
    prisma.userMfaConfig.findUnique.mockResolvedValue({ userId: "u1", secret: setup.secret });
    const code = generateTotp(setup.secret);

    await expect(service.verifyMfa("u1", code)).resolves.toEqual({ ok: true });
  });

  it("creates and disables users via SCIM", async () => {
    prisma.companyIamConfig.findFirst.mockResolvedValue({ companyId: "c1", scimEnabled: true, scimBearerToken: "token" });
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.role.findFirst.mockResolvedValue({ id: "r1" });
    prisma.user.create.mockResolvedValue({ id: "u1", email: "scim@acme.test", name: "SCIM", role: { name: "manager" } });

    const created = await service.scimCreateUserByToken("token", { userName: "scim@acme.test" });
    expect(created.id).toBe("u1");

    prisma.user.findFirst.mockResolvedValueOnce({ id: "u1", companyId: "c1", email: "scim@acme.test" });
    const disabled = await service.scimDisableUserByToken("token", "u1", { Operations: [{ path: "active", value: false }] });
    expect(disabled.ok).toBe(true);
  });
});
