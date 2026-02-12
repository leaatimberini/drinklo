import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  CreateSupplierInvoiceDto,
  ReceiveGoodsDto,
} from "./dto/purchasing.dto";

@Injectable()
export class PurchasingService {
  constructor(private readonly prisma: PrismaService) {}

  listSuppliers(companyId: string) {
    return this.prisma.supplier.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" } });
  }

  createSupplier(companyId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        companyId,
        name: dto.name,
        taxId: dto.taxId ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
      },
    });
  }

  listPurchaseOrders(companyId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { companyId },
      include: { supplier: true, items: { include: { variant: true } }, receipts: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPurchaseOrder(companyId: string, dto: CreatePurchaseOrderDto, createdById?: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, companyId, deletedAt: null } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    if (!dto.items?.length) throw new BadRequestException("PO requires items");

    const variants = await this.prisma.productVariant.findMany({
      where: { companyId, id: { in: dto.items.map((item) => item.variantId) }, deletedAt: null },
      select: { id: true },
    });
    const variantIds = new Set(variants.map((v) => v.id));
    for (const item of dto.items) {
      if (!variantIds.has(item.variantId)) {
        throw new NotFoundException(`Variant not found: ${item.variantId}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const total = dto.items.reduce((acc, item) => acc + item.quantityOrdered * item.unitCost, 0);
      const po = await tx.purchaseOrder.create({
        data: {
          companyId,
          supplierId: dto.supplierId,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          notes: dto.notes ?? null,
          totalAmount: new Prisma.Decimal(total),
          createdById: createdById ?? null,
        },
      });

      await tx.purchaseOrderItem.createMany({
        data: dto.items.map((item) => ({
          companyId,
          purchaseOrderId: po.id,
          variantId: item.variantId,
          quantityOrdered: item.quantityOrdered,
          unitCost: new Prisma.Decimal(item.unitCost),
        })),
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { supplier: true, items: { include: { variant: true } } },
      });
    });
  }

  async approvePurchaseOrder(companyId: string, purchaseOrderId: string, approvedById?: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, companyId }, include: { items: true } });
    if (!po) throw new NotFoundException("Purchase order not found");
    if (po.status !== "DRAFT") throw new BadRequestException("Only draft PO can be approved");

    return this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: approvedById ?? null,
      },
      include: { supplier: true, items: true },
    });
  }

  private async ensureDefaultStockLocation(tx: Prisma.TransactionClient, companyId: string) {
    const existing = await tx.stockLocation.findFirst({ where: { companyId, deletedAt: null } });
    if (existing) return existing;
    const branch = await tx.branch.findFirst({ where: { companyId } });
    return tx.stockLocation.create({
      data: {
        companyId,
        branchId: branch?.id ?? null,
        name: "Principal",
      },
    });
  }

  private async updateVariantCost(
    tx: Prisma.TransactionClient,
    companyId: string,
    variantId: string,
    quantityReceived: number,
    unitCost: Prisma.Decimal,
    goodsReceiptItemId: string,
  ) {
    const settings = await tx.companySettings.findFirst({ where: { companyId }, select: { inventoryCostMethod: true } });
    const method = (settings?.inventoryCostMethod ?? "WAVG").toUpperCase();

    const variant = await tx.productVariant.findFirst({ where: { id: variantId, companyId }, select: { id: true, cost: true } });
    if (!variant) return;

    if (method === "FIFO") {
      await tx.inventoryCostLayer.create({
        data: {
          companyId,
          variantId,
          goodsReceiptItemId,
          quantityInitial: quantityReceived,
          quantityRemaining: quantityReceived,
          unitCost,
          receivedAt: new Date(),
        },
      });
      if (!variant.cost) {
        await tx.productVariant.update({ where: { id: variantId }, data: { cost: unitCost } });
      }
      return;
    }

    const stockAgg = await tx.stockItem.aggregate({
      where: { companyId, variantId, deletedAt: null },
      _sum: { quantity: true },
    });
    const totalQtyAfter = stockAgg._sum.quantity ?? 0;
    const oldQty = Math.max(0, totalQtyAfter - quantityReceived);
    const oldCost = variant.cost ?? new Prisma.Decimal(0);

    const newCost = new Prisma.Decimal(
      oldQty === 0
        ? unitCost.toNumber()
        : (oldQty * oldCost.toNumber() + quantityReceived * unitCost.toNumber()) / (oldQty + quantityReceived),
    );

    await tx.productVariant.update({ where: { id: variantId }, data: { cost: newCost } });
  }

  async receiveGoods(companyId: string, purchaseOrderId: string, dto: ReceiveGoodsDto, receivedById?: string) {
    if (!dto.items?.length) throw new BadRequestException("Receipt requires items");

    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException("Purchase order not found");
    if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      throw new BadRequestException("PO must be approved before receipt");
    }

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          companyId,
          purchaseOrderId,
          receivedById: receivedById ?? null,
          notes: dto.notes ?? null,
        },
      });

      const location = await this.ensureDefaultStockLocation(tx, companyId);
      const resultLines: any[] = [];

      for (const line of dto.items) {
        let poItem = line.purchaseOrderItemId
          ? await tx.purchaseOrderItem.findFirst({ where: { id: line.purchaseOrderItemId, purchaseOrderId, companyId } })
          : null;

        if (!poItem && line.barcode) {
          const variant = await tx.productVariant.findFirst({ where: { companyId, barcode: line.barcode, deletedAt: null } });
          if (variant) {
            poItem = await tx.purchaseOrderItem.findFirst({ where: { purchaseOrderId, companyId, variantId: variant.id } });
          }
        }
        if (!poItem) {
          throw new NotFoundException("Purchase order item not found for line");
        }

        const unitCost = new Prisma.Decimal(line.unitCost ?? poItem.unitCost.toNumber());
        const nextReceived = poItem.quantityReceived + line.quantityReceived;
        const difference = nextReceived - poItem.quantityOrdered;

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: nextReceived },
        });

        const receiptItem = await tx.goodsReceiptItem.create({
          data: {
            companyId,
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: poItem.id,
            variantId: poItem.variantId,
            quantityReceived: line.quantityReceived,
            unitCost,
            quantityDifference: difference,
          },
        });

        const existingStock = await tx.stockItem.findFirst({
          where: {
            companyId,
            variantId: poItem.variantId,
            locationId: location.id,
            deletedAt: null,
          },
        });

        const stockItem =
          existingStock ??
          (await tx.stockItem.create({
            data: {
              companyId,
              branchId: location.branchId ?? null,
              variantId: poItem.variantId,
              locationId: location.id,
              quantity: 0,
              reservedQuantity: 0,
              createdById: receivedById ?? null,
              updatedById: receivedById ?? null,
            },
          }));

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantity: stockItem.quantity + line.quantityReceived,
            updatedById: receivedById ?? null,
          },
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            branchId: stockItem.branchId ?? null,
            stockItemId: stockItem.id,
            delta: line.quantityReceived,
            reason: "purchase_receipt",
          },
        });

        await this.updateVariantCost(tx, companyId, poItem.variantId, line.quantityReceived, unitCost, receiptItem.id);

        resultLines.push({
          purchaseOrderItemId: poItem.id,
          variantId: poItem.variantId,
          quantityReceived: line.quantityReceived,
          quantityOrdered: poItem.quantityOrdered,
          quantityReceivedTotal: nextReceived,
          quantityDifference: difference,
          unitCost: unitCost.toNumber(),
        });
      }

      const poItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId, companyId } });
      const allReceived = poItems.every((item) => item.quantityReceived >= item.quantityOrdered);
      const anyReceived = poItems.some((item) => item.quantityReceived > 0);

      const status = allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : "APPROVED";
      await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });

      return {
        receiptId: receipt.id,
        status,
        lines: resultLines,
      };
    });
  }

  createSupplierInvoice(companyId: string, dto: CreateSupplierInvoiceDto) {
    return this.prisma.supplierInvoice.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        goodsReceiptId: dto.goodsReceiptId ?? null,
        number: dto.number,
        issuedAt: new Date(dto.issuedAt),
        dueAt: new Date(dto.dueAt),
        subtotal: new Prisma.Decimal(dto.subtotal),
        taxAmount: new Prisma.Decimal(dto.taxAmount ?? 0),
        totalAmount: new Prisma.Decimal(dto.totalAmount),
      },
      include: { supplier: true, purchaseOrder: true },
    });
  }

  async reportAccountsPayable(companyId: string) {
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { companyId, status: { in: ["OPEN", "PARTIAL"] } },
      include: { supplier: true },
      orderBy: { dueAt: "asc" },
    });

    const totalOpen = invoices.reduce((acc, inv) => acc + inv.totalAmount.toNumber() - inv.paidAmount.toNumber(), 0);
    return {
      totalOpen,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        supplier: inv.supplier.name,
        dueAt: inv.dueAt,
        balance: inv.totalAmount.toNumber() - inv.paidAmount.toNumber(),
        status: inv.status,
      })),
    };
  }

  async reportPurchasesBySupplier(companyId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { companyId },
      include: { supplier: true },
    });
    const map = new Map<string, { supplierId: string; supplier: string; orders: number; total: number }>();
    for (const po of pos) {
      const row = map.get(po.supplierId) ?? {
        supplierId: po.supplierId,
        supplier: po.supplier.name,
        orders: 0,
        total: 0,
      };
      row.orders += 1;
      row.total += po.totalAmount.toNumber();
      map.set(po.supplierId, row);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  async reportCostVariance(companyId: string) {
    const items = await this.prisma.goodsReceiptItem.findMany({
      where: { companyId },
      include: {
        purchaseOrderItem: true,
        variant: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return items.map((item) => {
      const poCost = item.purchaseOrderItem.unitCost.toNumber();
      const receiptCost = item.unitCost.toNumber();
      return {
        goodsReceiptItemId: item.id,
        variant: item.variant.name,
        sku: item.variant.sku,
        poCost,
        receiptCost,
        variance: receiptCost - poCost,
        variancePct: poCost > 0 ? ((receiptCost - poCost) / poCost) * 100 : 0,
        quantityReceived: item.quantityReceived,
        at: item.createdAt,
      };
    });
  }
}
