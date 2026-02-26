import fs from "node:fs";
import path from "node:path";
import { AssistedImportService } from "./assisted-import.service";
import { parseFile } from "./import.helpers";

describe("AssistedImportService", () => {
  const fixture = (name: string) =>
    path.resolve(__dirname, "../../../../../tests/fixtures/imports", name);

  it("suggests deterministic mapping for bebidas headers", () => {
    const buffer = fs.readFileSync(fixture("products_bebidas_aliases.csv"));
    const { headers, rows } = parseFile(buffer);
    const service = new AssistedImportService();

    const suggestion = service.suggestMapping("products", headers, "bebidas");
    const mappedRows = service.applyMapping(rows, suggestion.mapping);

    expect(suggestion.mapping.name).toBe("Nombre Producto");
    expect(suggestion.mapping.description).toBe("Descripcion");
    expect(suggestion.mapping.barcode).toBe("EAN13");
    expect(suggestion.mapping.variantName).toBe("Presentacion ML");
    expect(suggestion.mapping.abv).toBe("Graduacion Alcoholica");
    expect(mappedRows[0]?.name).toBe("Cerveza Rubia Lata 473");
    expect(String(mappedRows[0]?.barcode)).toBe("7791234567890");
  });

  it("falls back safely when headers are unknown", () => {
    const buffer = fs.readFileSync(fixture("products_unknown_headers.csv"));
    const { headers } = parseFile(buffer);
    const service = new AssistedImportService();

    const suggestion = service.suggestMapping("products", headers, "bebidas");

    expect(suggestion.mapping.name).toBe("Producto X");
    expect(suggestion.mapping.sku).toBeNull();
    expect(suggestion.unmappedHeaders).toContain("Texto Libre");
    expect(suggestion.fields.find((f) => f.field === "name")?.candidates.length).toBeGreaterThan(0);
  });
});
