# Billing Mercado Pago Subscriptions / Suscripciones de Facturacion con Mercado Pago

## ES

### Objetivo
Integrar cobro recurrente de suscripciones de plataforma usando Mercado Pago (`preapproval`) por `Company`.

### Datos almacenados en `Subscription`
- `billingProvider` (`MERCADOPAGO`)
- `mpPreapprovalId`
- `mpPreapprovalStatus`
- `mpNextBillingDate`
- `mpSubscriptionRaw`
- `lastPaymentAt` (actualizado por webhook de cobro aprobado)

### Creacion / actualizacion de preapproval
Endpoint admin:
- `GET /billing/mercadopago/subscriptions/status`
- `POST /billing/mercadopago/subscriptions/preapproval`

Comportamiento:
- por defecto **no** crea preapproval durante `TRIAL_ACTIVE`
- se puede forzar con `allowDuringTrial=true`
- `BillingPlanChangesService` intenta crear/activar preapproval en upgrades si la cuenta estaba en `TRIAL_ACTIVE/GRACE/RESTRICTED`

### Webhooks (Mercado Pago)
Se extiende `POST /webhooks/mercadopago` para manejar:
- `preapproval`
- `subscription_preapproval`
- `authorized_payment` / `subscription_authorized_payment`
- `payment` (cuando corresponde a cobros recurrentes con `preapproval_id`)

### Idempotencia y logs
- `WebhookLog` (unique por `provider + eventId`)
- replays duplicados quedan como `duplicate`
- payload/headers se guardan redactados (DLP ya existente)

### Mapeo de estados (fallos de cobro)
Segun politica de lifecycle:
- fallo inicial: `ACTIVE_PAID -> PAST_DUE`
- fallo posterior: `PAST_DUE -> GRACE`
- si ya esta en `GRACE` y vence `graceEndAt`: `RESTRICTED`

`RESTRICTED` no borra datos; limita capacidades (prompt 106 / policy vigente).

### Trial
- Durante `TRIAL_ACTIVE`, no se crea preapproval por defecto.
- Al “convertir a pago” (ej. upgrade con activacion), se intenta crear/activar `preapproval`.
- La confirmacion efectiva de cobro se consolida via webhook (`payment` aprobado), que actualiza:
  - `Subscription.status = ACTIVE_PAID`
  - `lastPaymentAt`
  - `currentPeriodStart/currentPeriodEnd`

### Tests
- mock MP API en servicio de recurring billing
- replay de webhook duplicado en controller

---

## EN

### Goal
Add recurring billing using Mercado Pago subscriptions (`preapproval`) per `Company`.

### Stored fields on `Subscription`
- `billingProvider` (`MERCADOPAGO`)
- `mpPreapprovalId`
- `mpPreapprovalStatus`
- `mpNextBillingDate`
- `mpSubscriptionRaw`
- `lastPaymentAt` (updated from approved payment webhooks)

### Admin endpoints
- `GET /billing/mercadopago/subscriptions/status`
- `POST /billing/mercadopago/subscriptions/preapproval`

Default behavior:
- no preapproval is created while `TRIAL_ACTIVE` (unless `allowDuringTrial=true`)

### Webhooks
`POST /webhooks/mercadopago` now also handles subscription billing events:
- `preapproval`
- `subscription_preapproval`
- `authorized_payment` / `subscription_authorized_payment`
- recurring `payment` notifications (detected via `preapproval_id`)

### Idempotency
Webhook replays are deduplicated via `WebhookLog` (`provider + eventId` unique).

### Failure mapping
Recurring charge failures map to lifecycle states:
- `ACTIVE_PAID -> PAST_DUE`
- `PAST_DUE -> GRACE`
- `GRACE` past grace deadline -> `RESTRICTED`

