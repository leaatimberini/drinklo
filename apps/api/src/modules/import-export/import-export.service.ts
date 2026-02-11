import { Injectable } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { ImportError } from "./import.helpers";

const SUPPORTED = ["products", "variants", "prices", "stock", "customers"] as const;

export type ImportType = (typeof SUPPORTED)[number];

export type ImportResult = {
  ok: boolean;
  dryRun: boolean;
  errors: ImportError[];
  count: number;
  preview: Record<string, any>[];
};

function asBool(value: any) {
  if (typeof value === "boolean") return value;
  const str = String(value ?? "").toLowerCase();
  return str === "true" || str === "1" || str === "yes" || str === "si";
}

function asNumber(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

@Injectable()
export class ImportExportService {
  constructor(private readonly prisma: PrismaService) {}

  getSupportedTypes() {
    return SUPPORTED;
  }

  validate(type: ImportType, rows: Record<string, any>[]) {
    const errors: ImportError[] = [];
    const preview = rows.slice(0, 20);

    const requireField = (row: any, field: string, rowIndex: number) => {
      if (!row[field]) {
        errors.push({ row: rowIndex + 1, field, message: "Required" });
      }
    };

    rows.forEach((row, idx) => {
      if (type === "products") {
        requireField(row, "name", idx);
      }
      if (type === "variants") {
        requireField(row, "productId", idx);
        requireField(row, "sku", idx);
      }
      if (type === "prices") {
        requireField(row, "priceList", idx);
        requireField(row, "variantSku", idx);
        requireField(row, "price", idx);
        if (asNumber(row.price) === null) {
          errors.push({ row: idx + 1, field: "price", message: "Invalid number" });
        }
      }
      if (type === "stock") {
        requireField(row, "variantSku", idx);
        requireField(row, "location", idx);
        requireField(row, "quantity", idx);
        if (asNumber(row.quantity) === null) {
          errors.push({ row: idx + 1, field: "quantity", message: "Invalid number" });
        }
      }
      if (type === "customers") {
        requireField(row, "name", idx);
      }
    });

    return { errors, preview };
  }

  async validateRefs(type: ImportType, companyId: string, rows: Record<string, any>[]) {
    const errors: ImportError[] = [];

    if (type === "variants") {
      const productIds = Array.from(new Set(rows.map((r) => r.productId).filter(Boolean)));
      const products = await this.prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true },
      });
      const set = new Set(products.map((p) => p.id));
      rows.forEach((row, idx) => {
        if (row.productId && !set.has(row.productId)) {
          errors.push({ row: idx + 1, field: "productId", message: "Product not found" });
        }
      });
    }

    if (type === "prices") {
      const priceLists = Array.from(new Set(rows.map((r) => r.priceList).filter(Boolean)));
      const variants = Array.from(new Set(rows.map((r) => r.variantSku).filter(Boolean)));
      const listRows = await this.prisma.priceList.findMany({
        where: { companyId, name: { in: priceLists } },
        select: { name: true },
      });
      const variantRows = await this.prisma.productVariant.findMany({
        where: { companyId, sku: { in: variants } },
        select: { sku: true },
      });
      const listSet = new Set(listRows.map((l) => l.name));
      const variantSet = new Set(variantRows.map((v) => v.sku));
      rows.forEach((row, idx) => {
        if (row.priceList && !listSet.has(row.priceList)) {
          errors.push({ row: idx + 1, field: "priceList", message: "Price list not found" });
        }
        if (row.variantSku && !variantSet.has(row.variantSku)) {
          errors.push({ row: idx + 1, field: "variantSku", message: "Variant not found" });
        }
      });
    }

    if (type === "stock") {
      const variants = Array.from(new Set(rows.map((r) => r.variantSku).filter(Boolean)));
      const variantRows = await this.prisma.productVariant.findMany({
        where: { companyId, sku: { in: variants } },
        select: { sku: true },
      });
      const variantSet = new Set(variantRows.map((v) => v.sku));
      rows.forEach((row, idx) => {
        if (row.variantSku && !variantSet.has(row.variantSku)) {
          errors.push({ row: idx + 1, field: "variantSku", message: "Variant not found" });
        }
      });
    }

    return errors;
  }

  async apply(type: ImportType, companyId: string, rows: Record<string, any>[]) {
    if (type === "products") {
      return this.importProducts(companyId, rows);
    }
    if (type === "variants") {
      return this.importVariants(companyId, rows);
    }
    if (type === "prices") {
      return this.importPrices(companyId, rows);
    }
    if (type === "stock") {
      return this.importStock(companyId, rows);
    }
    return this.importCustomers(companyId, rows);
  }

  private async importProducts(companyId: string, rows: Record<string, any>[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const product = await tx.product.create({
          data: {
            companyId,
            name: row.name,
            description: row.description || null,
            imageUrl: row.imageUrl || null,
            isAlcoholic: asBool(row.isAlcoholic),
            abv: asNumber(row.abv) ?? undefined,
          },
        });
        if (row.sku) {
          await tx.productVariant.create({
            data: {
              companyId,
              productId: product.id,
              name: row.variantName || "Default",
              sku: row.sku,
              barcode: row.barcode || null,
            },
          });
        }
      }
    });
  }

  private async importVariants(companyId: string, rows: Record<string, any>[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.productVariant.create({
          data: {
            companyId,
            productId: row.productId,
            name: row.name || "Default",
            sku: row.sku,
            barcode: row.barcode || null,
          },
        });
      }
    });
  }

  private async importPrices(companyId: string, rows: Record<string, any>[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const priceList = await tx.priceList.findFirst({ where: { companyId, name: row.priceList } });
        if (!priceList) {
          throw new Error(`Price list not found: ${row.priceList}`);
        }
        const variant = await tx.productVariant.findFirst({ where: { companyId, sku: row.variantSku } });
        if (!variant) {
          throw new Error(`Variant not found: ${row.variantSku}`);
        }
        await tx.priceRule.create({
          data: {
            companyId,
            priceListId: priceList.id,
            variantId: variant.id,
            price: new Prisma.Decimal(asNumber(row.price) ?? 0),
          },
        });
      }
    });
  }

  private async importStock(companyId: string, rows: Record<string, any>[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const variant = await tx.productVariant.findFirst({ where: { companyId, sku: row.variantSku } });
        if (!variant) {
          throw new Error(`Variant not found: ${row.variantSku}`);
        }
        let location = await tx.stockLocation.findFirst({ where: { companyId, name: row.location } });
        if (!location) {
          location = await tx.stockLocation.create({
            data: {
              companyId,
              name: row.location,
            },
          });
        }

        const quantity = asNumber(row.quantity) ?? 0;

        const stockItem = await tx.stockItem.upsert({
          where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
          update: { quantity },
          create: {
            companyId,
            variantId: variant.id,
            locationId: location.id,
            quantity,
          },
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            stockItemId: stockItem.id,
            delta: quantity,
            reason: "import",
          },
        });
      }
    });
  }

  private async importCustomers(companyId: string, rows: Record<string, any>[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const customer = await tx.customer.create({
          data: {
            companyId,
            name: row.name,
            email: row.email || null,
            phone: row.phone || null,
          },
        });

        if (row.line1 || row.city || row.postalCode) {
          await tx.address.create({
            data: {
              companyId,
              customerId: customer.id,
              line1: row.line1 ?? "",
              line2: row.line2 || null,
              city: row.city ?? "",
              state: row.state || null,
              postalCode: row.postalCode ?? "",
              country: row.country ?? "AR",
            },
          });
        }
      }
    });
  }
}
