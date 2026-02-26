import { Prisma } from "@erp/db";
import { PurchasingService } from "./purchasing.service";

type State = {
  po: unknown;
  poItem: unknown;
  stockItem: unknown;
  variant: unknown;
  method: string;
  updatedPoStatus?: string;
  updatedCost?: number;
  createdLayers: number;
};

function makeService(state: State) {
  const tx = {
    goodsReceipt: {
      create: jest.fn(async () => ({ id: "gr-1" })),
    },
    stockLocation: {
      findFirst: jest.fn(async () => ({ id: "loc-1", branchId: "b-1", companyId: "c1" })),
      create: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(async () => ({ id: "b-1" })),
    },
    purchaseOrderItem: {
      findFirst: jest.fn(async () => state.poItem),
      update: jest.fn(async ({ data }: unknown) => {
        state.poItem.quantityReceived = data.quantityReceived;
        return state.poItem;
      }),
      findMany: jest.fn(async () => [state.poItem]),
    },
    goodsReceiptItem: {
      create: jest.fn(async ({ data }: unknown) => ({ id: "gri-1", ...data })),
    },
    stockItem: {
      findFirst: jest.fn(async () => state.stockItem),
      create: jest.fn(async () => state.stockItem),
      update: jest.fn(async ({ data }: unknown) => {
        state.stockItem.quantity = data.quantity;
        return state.stockItem;
      }),
      aggregate: jest.fn(async () => ({ _sum: { quantity: state.stockItem.quantity } })),
    },
    stockMovement: {
      create: jest.fn(async () => ({})),
    },
    batchLot: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => ({ id: "lot-1" })),
      update: jest.fn(async () => ({})),
    },
    companySettings: {
      findFirst: jest.fn(async () => ({ inventoryCostMethod: state.method })),
    },
    productVariant: {
      findFirst: jest.fn(async () => state.variant),
      update: jest.fn(async ({ data }: unknown) => {
        state.variant.cost = data.cost;
        state.updatedCost = Number((data.cost as Prisma.Decimal).toNumber());
        return state.variant;
      }),
    },
    inventoryCostLayer: {
      create: jest.fn(async () => {
        state.createdLayers += 1;
        return {};
      }),
    },
    purchaseOrder: {
      update: jest.fn(async ({ data }: unknown) => {
        state.updatedPoStatus = data.status;
        return { ...state.po, status: data.status };
      }),
    },
  };

  const prisma = {
    supplier: {
      findFirst: jest.fn(),
    },
    productVariant: {
      findMany: jest.fn(),
    },
    purchaseOrder: {
      findFirst: jest.fn(async () => state.po),
    },
    $transaction: jest.fn(async (fn: unknown) => fn(tx)),
  };

  return { service: new PurchasingService(prisma as never), tx, prisma };
}

describe("PurchasingService", () => {
  it("supports partial receipt and weighted average cost", async () => {
    const state: State = {
      po: { id: "po-1", companyId: "c1", status: "APPROVED", items: [{ id: "poi-1" }] },
      poItem: {
        id: "poi-1",
        purchaseOrderId: "po-1",
        companyId: "c1",
        variantId: "v-1",
        quantityOrdered: 10,
        quantityReceived: 0,
        unitCost: new Prisma.Decimal(100),
      },
      stockItem: { id: "si-1", companyId: "c1", variantId: "v-1", locationId: "loc-1", branchId: "b-1", quantity: 5 },
      variant: { id: "v-1", cost: new Prisma.Decimal(80) },
      method: "WAVG",
      createdLayers: 0,
    };
    const { service } = makeService(state);

    const result = await service.receiveGoods("c1", "po-1", {
      items: [{ purchaseOrderItemId: "poi-1", quantityReceived: 4, unitCost: 120 }],
    });

    expect(result.status).toBe("PARTIALLY_RECEIVED");
    expect(state.stockItem.quantity).toBe(9);
    expect(state.updatedPoStatus).toBe("PARTIALLY_RECEIVED");
    expect(state.updatedCost).toBeCloseTo((5 * 80 + 4 * 120) / 9, 4);
  });

  it("marks PO as received when all quantities completed", async () => {
    const state: State = {
      po: { id: "po-1", companyId: "c1", status: "PARTIALLY_RECEIVED", items: [{ id: "poi-1" }] },
      poItem: {
        id: "poi-1",
        purchaseOrderId: "po-1",
        companyId: "c1",
        variantId: "v-1",
        quantityOrdered: 10,
        quantityReceived: 6,
        unitCost: new Prisma.Decimal(100),
      },
      stockItem: { id: "si-1", companyId: "c1", variantId: "v-1", locationId: "loc-1", branchId: "b-1", quantity: 10 },
      variant: { id: "v-1", cost: new Prisma.Decimal(100) },
      method: "WAVG",
      createdLayers: 0,
    };
    const { service } = makeService(state);

    const result = await service.receiveGoods("c1", "po-1", {
      items: [{ purchaseOrderItemId: "poi-1", quantityReceived: 4 }],
    });

    expect(result.status).toBe("RECEIVED");
    expect(state.updatedPoStatus).toBe("RECEIVED");
  });

  it("creates FIFO cost layers when method is FIFO", async () => {
    const state: State = {
      po: { id: "po-1", companyId: "c1", status: "APPROVED", items: [{ id: "poi-1" }] },
      poItem: {
        id: "poi-1",
        purchaseOrderId: "po-1",
        companyId: "c1",
        variantId: "v-1",
        quantityOrdered: 3,
        quantityReceived: 0,
        unitCost: new Prisma.Decimal(90),
      },
      stockItem: { id: "si-1", companyId: "c1", variantId: "v-1", locationId: "loc-1", branchId: "b-1", quantity: 0 },
      variant: { id: "v-1", cost: new Prisma.Decimal(0) },
      method: "FIFO",
      createdLayers: 0,
    };
    const { service } = makeService(state);

    await service.receiveGoods("c1", "po-1", {
      items: [{ purchaseOrderItemId: "poi-1", quantityReceived: 3, unitCost: 90 }],
    });

    expect(state.createdLayers).toBe(1);
  });
});
