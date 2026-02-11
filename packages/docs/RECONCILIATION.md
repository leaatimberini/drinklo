# Reconciliation

## Report
Compares Mercado Pago payments, store orders, and POS sales for a given day.

Endpoints:
- `GET /admin/reconciliation/report?date=YYYY-MM-DD&tz=America/Argentina/Buenos_Aires`
- `GET /admin/reconciliation/export?date=YYYY-MM-DD&tz=America/Argentina/Buenos_Aires`

## Daily close
Report includes:
- Totals by payment provider (Mercado Pago)
- Totals by POS payment method
- Counts and differences

## Alerts
- `order_without_payment`: order marked PAID but no payment record
- `payment_without_order`: payment record without order

## Tests
Edge case tests in `apps/api/src/modules/reconciliation/reconciliation.service.spec.ts`.
