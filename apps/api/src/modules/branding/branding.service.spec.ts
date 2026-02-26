import { BrandingService } from "./branding.service";

describe("BrandingService", () => {
  it("rejects invalid signature", async () => {
    const prismaMock: unknown = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1", settings: { brandName: "A", domain: "d", logoUrl: "l", storefrontTheme: "A", adminTheme: "A" } }) },
    };
    const svc = new BrandingService(prismaMock as unknown);
    process.env.BRANDING_SECRET = "secret";

    await expect(
      svc.validateImport({ brandName: "X", domain: "d", logoUrl: "l", faviconUrl: null, seoTitle: null, seoDescription: null, seoKeywords: null, templateId: null, storefrontTheme: "A", adminTheme: "A" } as unknown, "bad"),
    ).rejects.toThrow("Invalid signature");
  });

  it("accepts valid signature", async () => {
    const prismaMock: unknown = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1", settings: { brandName: "A", domain: "d", logoUrl: "l", storefrontTheme: "A", adminTheme: "A" } }) },
    };
    const svc = new BrandingService(prismaMock as unknown);
    process.env.BRANDING_SECRET = "secret";

    const payload: unknown = {
      brandName: "X",
      domain: "d",
      logoUrl: "l",
      faviconUrl: null,
      seoTitle: null,
      seoDescription: null,
      seoKeywords: null,
      templateId: null,
      storefrontTheme: "A",
      adminTheme: "A",
    };

    const { signPayload } = await import("./branding-sign");
    const signature = signPayload(payload, "secret");
    const result = await svc.validateImport(payload, signature);
    expect(result.brandName).toBe("X");
  });
});
