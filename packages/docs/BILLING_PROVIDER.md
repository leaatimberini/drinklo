# Billing Provider

Modulo para cobrar suscripciones B2B desde el control-plane con Mercado Pago o flujo manual.

## Funcionalidades

- Planes y precios.
- Cuentas por instancia.
- Facturas, pagos y estado de cuenta.
- Cobro Mercado Pago (Checkout/Preference).
- Fallback manual (marcar facturas como pagadas).
- Suspension gradual: warning -> limitar features premium -> suspender (sin romper ventas basicas).

## Modelos (control-plane)

- BillingPlan
- BillingAccount
- BillingInvoice
- BillingPayment

## Endpoints (control-plane)

Admin:
- `GET /api/billing` (planes + cuentas)
- `POST /api/billing` (crear plan o cuenta)
- `POST /api/billing/invoices` (crear factura)
- `POST /api/billing/invoices/:id/mark-paid`
- `POST /api/billing/invoices/:id/pay` (Mercado Pago)

Portal cliente:
- `GET /api/billing/portal?instanceId=...` (requiere `x-portal-token`)

Licensing server:
- `POST /api/license/validate`

## Feature gating

El endpoint `/api/license/validate` controla el acceso:

- **Warning (1-7 dias)**: sin restricciones, solo alerta.
- **Past due (8-14 dias)**: se deshabilitan features premium.
- **Suspended (>14 dias)**: se mantienen ventas basicas, premium bloqueado.

## Configuracion

Control-plane `.env`:

- `CONTROL_PLANE_ADMIN_TOKEN`
- `CONTROL_PLANE_BILLING_PORTAL_TOKEN`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_WEBHOOK_URL`

Instancia:

- `LICENSE_SERVER_URL` apuntando al control-plane (`/api/license`)
- `INSTANCE_ID` configurado para validar licencias remotas

## UI

Control-plane:
- `/billing` para administrar planes y cuentas.

Customer portal:
- muestra estado de cuenta y facturas si se configura:
  - `NEXT_PUBLIC_CONTROL_PLANE_URL`
  - `NEXT_PUBLIC_BILLING_PORTAL_TOKEN`
