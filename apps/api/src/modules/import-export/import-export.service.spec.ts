import fs from "node:fs";
import path from "node:path";
import { ImportExportService } from "./import-export.service";
import { parseFile } from "./import.helpers";

describe("ImportExportService", () => {
  it("validates products CSV", () => {
    const buffer = fs.readFileSync(path.join("tests", "fixtures", "imports", "products.csv"));
    const { rows } = parseFile(buffer);
    const service = new ImportExportService({} as any);
    const result = service.validate("products", rows);
    expect(result.errors.length).toBe(0);
    expect(result.preview.length).toBeGreaterThan(0);
  });

  it("detects invalid products", () => {
    const buffer = fs.readFileSync(path.join("tests", "fixtures", "imports", "products_invalid.csv"));
    const { rows } = parseFile(buffer);
    const service = new ImportExportService({} as any);
    const result = service.validate("products", rows);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
