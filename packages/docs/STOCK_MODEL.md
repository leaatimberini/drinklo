# Stock Model

## Concepts
- **StockItem.quantity**: physical on-hand units.
- **StockItem.reservedQuantity**: units reserved for pending orders.
- **StockReservation**: per-order reservation with expiry and status.

## Reservation Flow
1. **Order created** ? reserve stock in transaction.
2. **Payment approved** ? confirm reservation:
   - decrement `quantity` and `reservedQuantity`.
   - mark reservation as `CONFIRMED`.
3. **Payment canceled/rejected** ? release reservation:
   - decrement `reservedQuantity`.
   - mark reservation as `CANCELED`.
4. **Expiration** (optional): release if `expiresAt` passed.

## Concurrency
Reservation uses atomic SQL update:
```
UPDATE StockItem
SET reservedQuantity = reservedQuantity + qty
WHERE quantity - reservedQuantity >= qty
```
If no rows updated, reservation fails (insufficient stock).

## TTL
`RESERVATION_TTL_MINUTES` (default 30) controls reservation expiry window.

## Files
- `apps/api/src/modules/stock-reservations/stock-reservation.service.ts`
- `apps/api/src/modules/checkout/checkout.service.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `packages/db/prisma/schema.prisma`
