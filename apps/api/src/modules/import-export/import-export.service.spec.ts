import fs from "node:fs";
import path from "node:path";
import { ImportExportService } from "./import-export.service";
import { parseFile } from "./import.helpers";

describe("ImportExportService", () => {
  const fixture = (name: string) =>
    path.resolve(__dirname, "../../../../../tests/fixtures/imports", name);

  it("validates products CSV", () => {
    const buffer = fs.readFileSync(fixture("products.csv"));
    const { rows } = parseFile(buffer);
    const service = new ImportExportService({} as unknown, {} as unknown, {} as unknown);
    const result = service.validate("products", rows);
    expect(result.errors.length).toBe(0);
    expect(result.preview.length).toBeGreaterThan(0);
  });

  it("detects invalid products", () => {
    const buffer = fs.readFileSync(fixture("products_invalid.csv"));
    const { rows } = parseFile(buffer);
    const service = new ImportExportService({} as unknown, {} as unknown, {} as unknown);
    const result = service.validate("products", rows);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("dispatches invalidation when prices are imported", async () => {
    const tx = {
      priceList: {
        findFirst: jest.fn().mockResolvedValue({ id: "pl1" }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({ id: "v1" }),
      },
      priceRule: {
        create: jest.fn().mockResolvedValue({ id: "pr1" }),
      },
    } as unknown;

    const prisma = {
      $transaction: jest.fn(async (run: unknown) => run(tx)),
    } as unknown;

    const edgeCache = {
      purgePricing: jest.fn().mockResolvedValue(undefined),
    } as unknown;

    const catalog = {
      invalidateAll: jest.fn(),
    } as unknown;

    const service = new ImportExportService(prisma, edgeCache, catalog);

    await service.apply("prices", "c1", [{ priceList: "Minorista", variantSku: "SKU-1", price: "1000" }]);

    expect(catalog.invalidateAll).toHaveBeenCalledTimes(1);
    expect(edgeCache.purgePricing).toHaveBeenCalledWith("c1", ["SKU-1"], "price_imported");
  });
});
