# Mercado Pago Checkout Pro

## Overview
This project uses Mercado Pago Checkout Pro with a server-side preference creation and a webhook for payment status updates.

## Credentials by Environment
- **Test / Sandbox**
  - Use Mercado Pago test credentials from the developer dashboard.
  - Set `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET` in your `.env`.
- **Production**
  - Use production credentials.
  - Replace all callback URLs (success/failure/pending/webhook) with production URLs.

## Required Env Vars
```
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_WEBHOOK_SECRET=...
MERCADOPAGO_WEBHOOK_URL=...
MERCADOPAGO_SUCCESS_URL=...
MERCADOPAGO_FAILURE_URL=...
MERCADOPAGO_PENDING_URL=...
```

## Flow
1. Storefront creates an order.
2. Frontend calls `POST /payments/mercadopago/preference` with `orderId`.
3. Backend creates a preference and returns `initPoint`.
4. Frontend redirects to Checkout Pro.
5. Webhook hits `/webhooks/mercadopago` with payment updates.
6. Backend validates the webhook signature and updates `Payment` + `OrderStatus`.

## Webhook Security
- Mercado Pago signs webhooks with `x-signature` and `x-request-id` headers.
- The signature is computed from `id`, `request-id`, `ts` and the webhook secret.
- The `id` value is obtained from the query param `data.id` (lowercased for the manifest).
- Idempotency is enforced via `WebhookLog` unique key `(provider, eventId)`.

## Data Model
- `Payment`: stores preference/payment status and raw payload.
- `WebhookLog`: stores webhook payloads for audit.

## Files
- Adapter: `apps/api/src/modules/payments/adapters/mercadopago.adapter.ts`
- Webhook: `apps/api/src/modules/payments/mercadopago.webhook.controller.ts`
- Preference endpoint: `apps/api/src/modules/payments/mercadopago.controller.ts`
- Storefront UI: `apps/storefront/app/checkout/page.tsx`
