import { BrandingService } from "./branding.service";

describe("BrandingService", () => {
  it("rejects invalid signature", async () => {
    const prismaMock: any = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1", settings: { brandName: "A", domain: "d", logoUrl: "l", storefrontTheme: "A", adminTheme: "A" } }) },
    };
    const svc = new BrandingService(prismaMock as any);
    process.env.BRANDING_SECRET = "secret";

    await expect(
      svc.validateImport({ brandName: "X", domain: "d", logoUrl: "l", faviconUrl: null, seoTitle: null, seoDescription: null, seoKeywords: null, templateId: null, storefrontTheme: "A", adminTheme: "A" } as any, "bad"),
    ).rejects.toThrow("Invalid signature");
  });

  it("accepts valid signature", async () => {
    const prismaMock: any = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1", settings: { brandName: "A", domain: "d", logoUrl: "l", storefrontTheme: "A", adminTheme: "A" } }) },
    };
    const svc = new BrandingService(prismaMock as any);
    process.env.BRANDING_SECRET = "secret";

    const payload: any = {
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
