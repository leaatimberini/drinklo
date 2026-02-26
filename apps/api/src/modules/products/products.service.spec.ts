import { ProductsService } from "./products.service";

describe("ProductsService edge invalidation", () => {
  const prisma = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    productVariant: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (run: unknown) => run(prisma)),
  } as unknown;

  const plugins = {
    decorateProduct: jest.fn(async (_companyId: string, item: unknown) => item),
  } as unknown;

  const catalog = {
    invalidateAll: jest.fn(),
  } as unknown;

  const edgeCache = {
    purgeProduct: jest.fn(),
  } as unknown;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("triggers invalidation on update", async () => {
    prisma.product.findFirst.mockResolvedValue({ id: "p1", companyId: "c1", deletedAt: null, variants: [] });
    prisma.product.update.mockResolvedValue({ id: "p1" });

    const service = new ProductsService(prisma, plugins, catalog, edgeCache);
    await service.update("c1", "p1", { name: "New" }, "u1");

    expect(catalog.invalidateAll).toHaveBeenCalledTimes(1);
    expect(edgeCache.purgeProduct).toHaveBeenCalledWith("c1", "p1", "product_updated");
  });
});
