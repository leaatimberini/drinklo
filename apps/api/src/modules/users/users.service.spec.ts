import { UsersService } from "./users.service";

const prismaMock = {
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService(prismaMock as any);
    prismaMock.user.findMany.mockReset();
    prismaMock.user.findFirst.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
  });

  it("creates a user", async () => {
    prismaMock.user.create.mockResolvedValue({ id: "user-2" });

    const result = await service.create(
      "company-1",
      { email: "u@acme.local", name: "User", roleId: "role-1", password: "pass" },
      "admin-1",
    );

    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(result.id).toBe("user-2");
  });

  it("soft deletes a user", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-2" });
    prismaMock.user.update.mockResolvedValue({ id: "user-2", deletedAt: new Date() });

    const result = await service.remove("company-1", "user-2", "admin-1");

    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(result.id).toBe("user-2");
  });
});
