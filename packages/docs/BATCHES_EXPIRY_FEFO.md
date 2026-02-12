# Batches, Expiry & FEFO (ES/EN)

## ES

### Objetivo
Agregar trazabilidad de lotes por stock item, estrategia de picking FEFO/FIFO y controles de vencimiento para prevenir ventas inválidas.

### Modelo de datos
- `BatchLot`
- `id`, `companyId`, `branchId?`, `stockItemId`, `variantId`
- `lotCode`, `manufacturingDate?`, `expiryDate?`
- `quantity`, `reservedQuantity`
- `createdAt`, `updatedAt`

- `StockReservationLot`
- une `StockReservation` con `BatchLot`
- guarda cantidad reservada por lote para poder confirmar/liberar de forma consistente

- `CompanySettings`
- `pickingStrategy`: `FEFO | FIFO`
- `blockExpiredLotSale`: `boolean`

### Flujo operativo
1. Recepción de mercadería (`PurchasingService.receiveGoods`):
- crea/actualiza `BatchLot` por línea recibida (`lotCode`, fechas y cantidad).

2. Reserva de stock:
- se asignan lotes con FEFO (o FIFO según config),
- se incrementa `reservedQuantity` en lote y stock item,
- se guarda asignación en `StockReservationLot`.

3. Confirmación de reserva/pago:
- descuenta cantidades efectivas de lote y stock item,
- marca reserva confirmada.

4. Cancelación/expiración:
- libera `reservedQuantity` por lote y stock item.

5. Venta POS directa:
- consume lotes en múltiple lote si hace falta.

### FEFO / bloqueo de vencidos
- FEFO: ordena por `expiryDate ASC`, luego `createdAt ASC`.
- FIFO: ordena por `createdAt ASC`.
- Si `blockExpiredLotSale=true`, lotes vencidos quedan excluidos del picking y la operación falla si no hay stock válido.

### Endpoints API (admin)
- `GET /stock/lots/config`
- `PATCH /stock/lots/config`
- `GET /stock/lots/alerts?days=30`
- `GET /stock/lots/alerts/windows` (30/60/90)
- `GET /stock/lots/rotation?limit=20`
- `GET /stock/lots/product/:productId`

### UI
- `apps/admin`: `/lots` muestra alertas por vencimiento + sugerencias de rotación.
- `apps/storefront`: PDP incluye panel “Modo admin: próximos a vencer” (requiere JWT admin).

### Tests incluidos
- FEFO selecciona primero lote más próximo a vencer.
- Venta con lotes múltiples descuenta más de un lote cuando corresponde.
- Bloqueo de venta con lotes vencidos al activar `blockExpiredLotSale`.

## EN

### Goal
Add lot-level traceability per stock item, FEFO/FIFO picking strategy, and expiry controls to prevent invalid sales.

### Data model
- `BatchLot`
- `id`, `companyId`, `branchId?`, `stockItemId`, `variantId`
- `lotCode`, `manufacturingDate?`, `expiryDate?`
- `quantity`, `reservedQuantity`
- `createdAt`, `updatedAt`

- `StockReservationLot`
- links `StockReservation` with `BatchLot`
- stores reserved quantity per lot for consistent confirm/release flows

- `CompanySettings`
- `pickingStrategy`: `FEFO | FIFO`
- `blockExpiredLotSale`: `boolean`

### Operational flow
1. Goods receipt (`PurchasingService.receiveGoods`):
- creates/updates `BatchLot` per received line (`lotCode`, dates, quantity).

2. Stock reservation:
- assigns lots via FEFO (or FIFO from config),
- increments lot + stock-item `reservedQuantity`,
- stores assignment in `StockReservationLot`.

3. Reservation/payment confirmation:
- decrements actual lot and stock quantities,
- marks reservation as confirmed.

4. Cancel/expire:
- releases lot + stock-item `reservedQuantity`.

5. Direct POS sale:
- consumes lots, splitting across multiple lots when needed.

### FEFO / expired-blocking
- FEFO: `expiryDate ASC`, then `createdAt ASC`.
- FIFO: `createdAt ASC`.
- With `blockExpiredLotSale=true`, expired lots are excluded and operation fails if no valid stock remains.

### API endpoints (admin)
- `GET /stock/lots/config`
- `PATCH /stock/lots/config`
- `GET /stock/lots/alerts?days=30`
- `GET /stock/lots/alerts/windows` (30/60/90)
- `GET /stock/lots/rotation?limit=20`
- `GET /stock/lots/product/:productId`

### UI
- `apps/admin`: `/lots` page shows expiry alerts + rotation suggestions.
- `apps/storefront`: PDP includes an “Admin mode: near expiry” panel (admin JWT required).

### Included tests
- FEFO prioritizes earliest-expiry lot.
- Multi-lot sale consumption works when one lot is not enough.
- Expired-sale blocking works with `blockExpiredLotSale` enabled.
