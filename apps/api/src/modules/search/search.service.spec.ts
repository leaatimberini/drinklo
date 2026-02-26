import { Prisma } from "@erp/db";
import { SearchService } from "./search.service";

const indexMock = {
  updateSettings: jest.fn(),
  updateSynonyms: jest.fn(),
  addDocuments: jest.fn(),
  deleteDocuments: jest.fn(),
  search: jest.fn(),
};

const meiliMock = {
  index: jest.fn(() => indexMock),
};

jest.mock("meilisearch", () => ({
  MeiliSearch: jest.fn(() => meiliMock),
}));

describe("SearchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MEILI_HOST = "http://localhost:7700";
  });

  function buildService(overrides: Partial<unknown> = {}) {
    const prisma = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: "c1" }) },
      searchConfig: {
        findUnique: jest.fn().mockResolvedValue({ companyId: "c1", synonyms: {}, boosters: { stockWeight: 1, marginWeight: 1 } }),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      priceList: {
        findFirst: jest.fn().mockResolvedValue({ id: "pl1" }),
      },
      priceRule: {
        findMany: jest.fn().mockResolvedValue([
          { variantId: "v1", productId: null, minQty: 1, price: new Prisma.Decimal(1000) },
        ]),
      },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: "p1",
              name: "Coca Cola",
              description: "Cola",
              updatedAt: new Date(),
              variants: [
                {
                  id: "v1",
                  sku: "COCA-1",
                  barcode: "123",
                  updatedAt: new Date(),
                  cost: new Prisma.Decimal(600),
                },
              ],
              productCats: [{ categoryId: "cat1", category: { id: "cat1", name: "Gaseosas" } }],
              attributes: [{ key: "brand", value: "Coca Cola" }],
            },
          ]),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: "cat1", name: "Gaseosas", slug: "gaseosas" }]),
      },
      stockItem: {
        groupBy: jest.fn().mockResolvedValue([{ variantId: "v1", _sum: { quantity: 10 } }]),
      },
      searchIndexState: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ companyId: "c1", lastIndexedAt: new Date() }),
        update: jest.fn(),
      },
      ...overrides,
    };

    return { service: new SearchService(prisma as unknown), prisma };
  }

  it("indexes documents on full reindex", async () => {
    const { service } = buildService();
    await service.fullReindex("c1");
    expect(indexMock.addDocuments).toHaveBeenCalled();
    expect(indexMock.updateSettings).toHaveBeenCalled();
  });

  it("deletes documents on incremental reindex when needed", async () => {
    const productDeleted = {
      id: "p2",
      name: "Deleted",
      updatedAt: new Date(),
      variants: [{ id: "v2" }],
    };
    const { service } = buildService({
      product: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([productDeleted]),
      },
      category: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      stockItem: { groupBy: jest.fn().mockResolvedValue([]) },
      priceRule: { findMany: jest.fn().mockResolvedValue([]) },
    });

    await service.incrementalReindex("c1");
    expect(indexMock.deleteDocuments).toHaveBeenCalledWith(["variant:v2"]);
  });

  it("searches catalog and returns suggestions", async () => {
    indexMock.search.mockResolvedValueOnce({
      query: "coca",
      hits: [{ id: "v1", name: "Coca Cola" }],
      estimatedTotalHits: 1,
    });
    const { service } = buildService();
    const res = await service.searchCatalog("c1", "coca", 10, 0);
    expect(res.suggestions).toContain("Coca Cola");
  });
});
