import { Prisma, TaxPriceMode, TaxRoundingMode, TaxRoundingScope, TaxRuleKind } from "@erp/db";
import { TaxesService } from "./taxes.service";

function makePrismaMock(overrides?: Partial<any>) {
  const profile = {
    id: "tp1",
    companyId: "co1",
    name: "Default",
    isDefault: true,
    currency: "ARS",
    ivaDefaultMode: TaxPriceMode.EXCLUDED,
    roundingMode: TaxRoundingMode.HALF_UP,
    roundingScope: TaxRoundingScope.TOTAL,
    roundingIncrement: new Prisma.Decimal(0.01),
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    taxProfile: {
      findFirst: jest.fn().mockResolvedValue(profile),
      create: jest.fn().mockResolvedValue(profile),
      update: jest.fn(),
    },
    taxRule: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
    ...overrides,
  } as any;
}

describe("TaxesService", () => {
  it("calcula IVA excluido", async () => {
    const prisma = makePrismaMock();
    prisma.taxRule.findMany.mockResolvedValue([
      {
        id: "r1",
        companyId: "co1",
        taxProfileId: "tp1",
        name: "IVA 21",
        isActive: true,
        kind: TaxRuleKind.IVA,
        rate: new Prisma.Decimal(0.21),
        priceMode: TaxPriceMode.EXCLUDED,
        priority: 10,
        applyToShipping: false,
        deletedAt: null,
      },
    ]);
    const service = new TaxesService(prisma);

    const result = await service.simulate("co1", {
      items: [{ quantity: 1, unitPrice: 100 }],
      shippingCost: 0,
      discountTotal: 0,
      currency: "ARS",
    });

    expect(result.totals.baseAmount).toBe(100);
    expect(result.totals.ivaAmount).toBe(21);
    expect(result.totals.totalTaxAmount).toBe(21);
    expect(result.totals.totalAmount).toBe(121);
  });

  it("calcula IVA incluido sin alterar total pagable", async () => {
    const prisma = makePrismaMock({
      taxProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: "tp1",
          companyId: "co1",
          name: "Default",
          isDefault: true,
          currency: "ARS",
          ivaDefaultMode: TaxPriceMode.INCLUDED,
          roundingMode: TaxRoundingMode.HALF_UP,
          roundingScope: TaxRoundingScope.TOTAL,
          roundingIncrement: new Prisma.Decimal(0.01),
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    prisma.taxRule.findMany.mockResolvedValue([
      {
        id: "r1",
        companyId: "co1",
        taxProfileId: "tp1",
        name: "IVA 21 inc",
        isActive: true,
        kind: TaxRuleKind.IVA,
        rate: new Prisma.Decimal(0.21),
        priceMode: TaxPriceMode.INCLUDED,
        priority: 10,
        applyToShipping: false,
        deletedAt: null,
      },
    ]);
    const service = new TaxesService(prisma);

    const result = await service.simulate("co1", {
      items: [{ quantity: 1, unitPrice: 121 }],
      currency: "ARS",
    });

    expect(result.totals.baseAmount).toBe(121);
    expect(result.totals.ivaAmount).toBe(21);
    expect(result.totals.totalAmount).toBe(121);
    expect(result.lines[0]?.netTaxableBase).toBe(100);
  });

  it("aplica multiples reglas con filtros por producto/categoria/ubicacion", async () => {
    const prisma = makePrismaMock();
    prisma.taxRule.findMany.mockResolvedValue([
      {
        id: "iva",
        companyId: "co1",
        taxProfileId: "tp1",
        name: "IVA 21",
        isActive: true,
        kind: TaxRuleKind.IVA,
        rate: new Prisma.Decimal(0.21),
        priceMode: TaxPriceMode.EXCLUDED,
        priority: 10,
        applyToShipping: false,
        locationCountry: "AR",
        locationState: "Buenos Aires",
        locationCity: null,
        postalCodePrefix: "14",
        productId: null,
        categoryId: null,
        deletedAt: null,
      },
      {
        id: "perc",
        companyId: "co1",
        taxProfileId: "tp1",
        name: "Perc IIBB",
        isActive: true,
        kind: TaxRuleKind.PERCEPTION,
        rate: new Prisma.Decimal(0.03),
        priceMode: null,
        priority: 20,
        applyToShipping: false,
        productId: "p1",
        categoryId: null,
        locationCountry: "AR",
        locationState: null,
        locationCity: null,
        postalCodePrefix: null,
        deletedAt: null,
      },
      {
        id: "ret",
        companyId: "co1",
        taxProfileId: "tp1",
        name: "Retencion",
        isActive: true,
        kind: TaxRuleKind.WITHHOLDING,
        rate: new Prisma.Decimal(0.015),
        priceMode: null,
        priority: 30,
        applyToShipping: false,
        productId: null,
        categoryId: "cat1",
        locationCountry: null,
        locationState: null,
        locationCity: null,
        postalCodePrefix: null,
        deletedAt: null,
      },
    ]);
    const service = new TaxesService(prisma);

    const result = await service.simulate("co1", {
      currency: "ARS",
      shippingCost: 10,
      address: {
        country: "AR",
        state: "Buenos Aires",
        postalCode: "1425",
      },
      items: [{ productId: "p1", categoryIds: ["cat1"], quantity: 1, unitPrice: 100 }],
    });

    expect(result.totals.ivaAmount).toBe(21);
    expect(result.totals.perceptionAmount).toBe(3);
    expect(result.totals.withholdingAmount).toBe(1.5);
    expect(result.totals.totalTaxAmount).toBe(22.5);
    expect(result.totals.totalAmount).toBe(132.5);
  });

  it("no aplica impuestos si el perfil esta deshabilitado", async () => {
    const prisma = makePrismaMock({
      taxProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: "tp1",
          companyId: "co1",
          name: "Default",
          isDefault: true,
          currency: "ARS",
          ivaDefaultMode: TaxPriceMode.EXCLUDED,
          roundingMode: TaxRoundingMode.HALF_UP,
          roundingScope: TaxRoundingScope.TOTAL,
          roundingIncrement: new Prisma.Decimal(0.01),
          enabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    prisma.taxRule.findMany.mockResolvedValue([
      {
        id: "r1",
        kind: TaxRuleKind.IVA,
        rate: new Prisma.Decimal(0.21),
        priceMode: TaxPriceMode.EXCLUDED,
        isActive: true,
        applyToShipping: false,
        deletedAt: null,
      },
    ]);
    const service = new TaxesService(prisma);

    const result = await service.simulate("co1", {
      items: [{ quantity: 1, unitPrice: 100 }],
      currency: "ARS",
    });

    expect(result.totals.totalTaxAmount).toBe(0);
    expect(result.totals.totalAmount).toBe(100);
  });
});
