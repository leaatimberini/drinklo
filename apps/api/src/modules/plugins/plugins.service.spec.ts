import { PluginsService } from "./plugins.service";

const prismaMock = {
  companyPlugin: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

describe("PluginsService", () => {
  it("applies pricing hooks only when scope allowed", async () => {
    const service = new PluginsService(prismaMock as any);
    (service as any).loaded = true;
    (service as any).plugins = [
      {
        manifest: {
          name: "promo-rule",
          version: "0.1.0",
          permissions: ["pricing:write"],
        },
        module: {
          hooks: {
            "pricing.unitPrice": ({ item }: any) => ({ unitPrice: item.unitPrice * 0.5 }),
          },
        },
        root: "",
      },
    ];

    prismaMock.companyPlugin.findMany.mockResolvedValue([
      { name: "promo-rule", enabled: true, allowedPermissions: ["pricing:write"] },
    ]);

    const result = await service.applyPricingRules("c1", [
      { productId: "p1", quantity: 1, unitPrice: 1000 },
    ]);
    expect(result[0].unitPrice).toBe(500);
  });

  it("skips pricing hooks when permission is not allowed", async () => {
    const service = new PluginsService(prismaMock as any);
    (service as any).loaded = true;
    (service as any).plugins = [
      {
        manifest: {
          name: "promo-rule",
          version: "0.1.0",
          permissions: ["pricing:write"],
        },
        module: {
          hooks: {
            "pricing.unitPrice": ({ item }: any) => ({ unitPrice: item.unitPrice * 0.5 }),
          },
        },
        root: "",
      },
    ];

    prismaMock.companyPlugin.findMany.mockResolvedValue([
      { name: "promo-rule", enabled: true, allowedPermissions: ["products:read"] },
    ]);

    const result = await service.applyPricingRules("c1", [
      { productId: "p1", quantity: 1, unitPrice: 1000 },
    ]);
    expect(result[0].unitPrice).toBe(1000);
  });

  it("does not return UI slots when plugin disabled", async () => {
    const service = new PluginsService(prismaMock as any);
    (service as any).loaded = true;
    (service as any).plugins = [
      {
        manifest: {
          name: "product-label",
          version: "0.1.0",
          permissions: ["products:read"],
        },
        module: {
          uiSlots: {
            "admin.dashboard": () => ({ title: "Test", body: "Body" }),
          },
        },
        root: "",
      },
    ];

    prismaMock.companyPlugin.findMany.mockResolvedValue([]);

    const slots = await service.getUiSlots("c1", "admin.dashboard");
    expect(slots).toHaveLength(0);
  });
});
