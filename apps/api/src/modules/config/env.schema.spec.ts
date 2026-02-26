import { validateEnv } from "./env.schema";

describe("validateEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() =>
      validateEnv({
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "test-secret",
      }),
    ).toThrow(/DATABASE_URL/i);
  });

  it("accepts minimal required environment", () => {
    const result = validateEnv({
      DATABASE_URL: "postgresql://erp:erp@localhost:5432/erp",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "test-secret",
    });

    expect(result.DATABASE_URL).toContain("postgresql://");
    expect(result.PORT).toBe(3001);
    expect(result.NODE_ENV).toBe("development");
  });
});
