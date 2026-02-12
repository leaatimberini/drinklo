# Purchasing & Suppliers (ES/EN)

## ES

### Objetivo
Implementar módulo de Compras con ciclo completo:
- Proveedores
- Órdenes de compra
- Recepciones parciales/totales
- Actualización de stock y costo
- Reportes de compras y cuentas a pagar

### Entidades
En `packages/db/prisma/schema.prisma`:
- `Supplier`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `GoodsReceipt`
- `GoodsReceiptItem`
- `SupplierInvoice`
- `InventoryCostLayer` (soporte FIFO)

Adicional:
- `CompanySettings.inventoryCostMethod` = `WAVG` | `FIFO` (string)

Migración:
- `packages/db/prisma/migrations/20260212_purchasing/migration.sql`

### Flujo operativo
1. Crear PO (`DRAFT`).
2. Aprobar PO (`APPROVED`).
3. Recibir mercadería (`/purchasing/orders/:id/receive`), parcial o total.
4. En cada recepción:
- actualiza `PurchaseOrderItem.quantityReceived`
- crea `GoodsReceipt` + `GoodsReceiptItem`
- incrementa stock (`StockItem`) + `StockMovement` reason `purchase_receipt`
- recalcula costo por método de compañía
5. Estado PO:
- `PARTIALLY_RECEIVED` cuando recibe parcialmente
- `RECEIVED` cuando completa cantidades

### Costos
- `WAVG` (promedio ponderado): recalcula costo variante con stock previo + recepción.
- `FIFO`: crea `InventoryCostLayer` por recepción; costo de capa queda disponible para valuación FIFO.

### Endpoints API
Prefijo: `/purchasing`
- `GET /suppliers`
- `POST /suppliers`
- `GET /orders`
- `POST /orders`
- `POST /orders/:id/approve`
- `POST /orders/:id/receive`
- `POST /supplier-invoices`
- `GET /reports/accounts-payable`
- `GET /reports/by-supplier`
- `GET /reports/cost-variance`

### UI Admin
- `apps/admin/app/purchasing/page.tsx`
- Incluye:
  - alta de proveedor
  - creación/aprobación PO
  - recepción con input de barcode (scanner teclado)
  - diferencias `recibido - ordenado`

### Reportes
- Cuentas a pagar (facturas `OPEN`/`PARTIAL` con saldo)
- Compras por proveedor
- Variación de costos (costo PO vs costo real recepción)

### Tests
- `apps/api/src/modules/purchasing/purchasing.service.spec.ts`
- Casos:
  - recepciones parciales
  - ajuste de stock en recepción
  - cálculo de costos (`WAVG` y capa `FIFO`)

---

## EN

### Goal
Implement full Purchasing module:
- Suppliers
- Purchase Orders
- Partial/full goods receipts
- Stock and cost update
- Payables and purchasing reports

### Entities
In `packages/db/prisma/schema.prisma`:
- `Supplier`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `GoodsReceipt`
- `GoodsReceiptItem`
- `SupplierInvoice`
- `InventoryCostLayer` (FIFO support)

Additional:
- `CompanySettings.inventoryCostMethod` = `WAVG` | `FIFO`

Migration:
- `packages/db/prisma/migrations/20260212_purchasing/migration.sql`

### Operational flow
1. Create PO (`DRAFT`)
2. Approve PO (`APPROVED`)
3. Receive goods (partial/full)
4. On receipt:
- update PO item received qty
- create receipt records
- increase stock + movement
- update cost according to company method
5. PO status transitions to `PARTIALLY_RECEIVED` or `RECEIVED`.

### Cost methods
- `WAVG`: weighted average update.
- `FIFO`: create `InventoryCostLayer` per receipt.

### API
Prefix: `/purchasing`
- suppliers CRUD-lite
- orders create/list/approve/receive
- supplier invoices create
- reports: accounts payable, by supplier, cost variance

### Admin UI
- `apps/admin/app/purchasing/page.tsx`
- Includes barcode-based receiving and PO variance view.

### Tests
- `apps/api/src/modules/purchasing/purchasing.service.spec.ts`
- Covers partial receipts, stock adjustment, cost calculations.
