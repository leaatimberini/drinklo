# Marketing Automation

Motor de automatizaciones con triggers, acciones y guardrails para comunicación responsable.

## Entidades

- `Segment`: definición de audiencia (JSON con condiciones).
- `Campaign`: agrupador de flows.
- `Flow`: trigger + condiciones + guardrails + acciones.
- `Trigger`: tipo (carrito abandonado, post-compra, cumpleaños, stock-back, winback).
- `Action`: email, push/in-app (stub), telegram (stub), cupones.
- `SuppressionList`: exclusiones por canal/valor.

## Triggers soportados

- `CART_ABANDONED`
- `POST_PURCHASE`
- `BIRTHDAY`
- `STOCK_BACK`
- `WINBACK`

## Acciones soportadas

- `EMAIL` (usa templates existentes)
- `PUSH` (stub)
- `IN_APP` (stub)
- `TELEGRAM` (stub)
- `COUPON` (stub)

## Guardrails

- **Frequency cap**: máximo envíos por día y destinatario.
- **Quiet hours**: horario BA donde no se envía (default 22:00–08:00).
- **Consent**: requiere consentimiento de marketing (`ConsentRecord`).
- **Suppression list**: bloqueos explícitos por canal/valor.

## Endpoints (admin)

Base: `/admin/automation`

- `GET /segments` / `POST /segments`
- `GET /campaigns` / `POST /campaigns`
- `GET /triggers` / `POST /triggers` / `PATCH /triggers/:id`
- `GET /flows` / `POST /flows` / `PATCH /flows/:id`
- `POST /flows/:id/actions` / `PATCH /actions/:id` / `POST /actions/:id/delete`
- `POST /flows/:id/test-run`
- `GET /flows/:id/metrics`
- `POST /flows/:id/metrics`
- `GET /suppressions` / `POST /suppressions`

## Editor visual (admin)

Ruta: `/automation`

Incluye:
- editor simple de condiciones + guardrails
- acciones con delay y configuración JSON
- test run con recipient
- métricas de flow

## Métricas

Se almacenan por flow y por día:
- `sent`
- `opened`
- `converted`

Se actualizan en el test-run y vía endpoint `metrics`.

## Notas

- Las acciones Push/In-App/Telegram/Coupon son stubs por defecto.
- Email requiere `templateId` en la acción y usa el sistema de templates existente.
