CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CANCELED');
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('OPEN','PARTIAL','PAID','VOID');

ALTER TABLE IF EXISTS "CompanySettings"
  ADD COLUMN IF NOT EXISTS "inventoryCostMethod" TEXT NOT NULL DEFAULT 'WAVG';

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "expectedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantityOrdered" INTEGER NOT NULL,
  "quantityReceived" INTEGER NOT NULL DEFAULT 0,
  "unitCost" NUMERIC(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "receivedById" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsReceiptItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "purchaseOrderItemId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantityReceived" INTEGER NOT NULL,
  "unitCost" NUMERIC(12,4) NOT NULL,
  "quantityDifference" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "goodsReceiptId" TEXT,
  "number" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "subtotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "taxAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "paidAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryCostLayer" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "goodsReceiptItemId" TEXT,
  "quantityInitial" INTEGER NOT NULL,
  "quantityRemaining" INTEGER NOT NULL,
  "unitCost" NUMERIC(12,4) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCostLayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE INDEX "PurchaseOrder_companyId_idx" ON "PurchaseOrder"("companyId");
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");
CREATE INDEX "PurchaseOrderItem_companyId_idx" ON "PurchaseOrderItem"("companyId");
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "PurchaseOrderItem_variantId_idx" ON "PurchaseOrderItem"("variantId");
CREATE INDEX "GoodsReceipt_companyId_idx" ON "GoodsReceipt"("companyId");
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");
CREATE INDEX "GoodsReceiptItem_companyId_idx" ON "GoodsReceiptItem"("companyId");
CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId");
CREATE INDEX "GoodsReceiptItem_variantId_idx" ON "GoodsReceiptItem"("variantId");
CREATE INDEX "SupplierInvoice_companyId_idx" ON "SupplierInvoice"("companyId");
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");
CREATE INDEX "SupplierInvoice_status_idx" ON "SupplierInvoice"("status");
CREATE INDEX "SupplierInvoice_dueAt_idx" ON "SupplierInvoice"("dueAt");
CREATE INDEX "InventoryCostLayer_companyId_idx" ON "InventoryCostLayer"("companyId");
CREATE INDEX "InventoryCostLayer_variantId_idx" ON "InventoryCostLayer"("variantId");
CREATE INDEX "InventoryCostLayer_receivedAt_idx" ON "InventoryCostLayer"("receivedAt");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

