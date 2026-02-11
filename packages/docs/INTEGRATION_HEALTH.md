# Integration Health Checks

## Overview
Admin endpoints run health checks for Mercado Pago and Andreani, store results, and surface a semaphore UI in `apps/admin`.

## Endpoints
Admin (requires `settings:write`):
- `GET /admin/integrations/health`
- `GET /admin/integrations/logs?limit=50`
- `POST /admin/integrations/health/mercadopago/webhook-test`

## Mercado Pago
Health check:
- Calls `GET /users/me` with `Authorization: Bearer <access_token>` to validate credentials. citeturn0search0turn0search7

Webhook test:
- Inserts a test `WebhookLog` and attempts to insert the same `eventId` twice.
- Duplicate detection is enforced by the DB unique constraint `(provider, eventId)` and returns `duplicateDetected=true`.

Webhook signature notes:
- Mercado Pago sends `x-signature` with `ts` and `v1`, and `x-request-id` headers for signature verification. citeturn0search5
- Some providers can deliver duplicate webhooks; this system is idempotent via `WebhookLog` uniqueness.

## Andreani (GlobAllPack)
Health check:
- Quote: uses Cotizador API (GET) to validate auth/token and rate calculation. citeturn1search5
- Create (optional): uses Preenvio API (POST) if `ANDREANI_TEST_CREATE=true`. citeturn1search1
- Track (optional): uses Trazabilidad API (GET) if `ANDREANI_TEST_TRACKING_CODE` is set. citeturn0search3

Auth:
- Login via Basic Auth to obtain token (`x-authorization-token`) for subsequent calls. citeturn1search4

## UI
Admin page:
- `apps/admin/app/integrations/page.tsx`
- Shows OK/WARN/FAIL per integration with logs.

## Configuration
Env vars (API):
- `ANDREANI_TEST_POSTAL`, `ANDREANI_TEST_CITY`, `ANDREANI_TEST_COUNTRY`, `ANDREANI_TEST_WEIGHT_KG`
- `ANDREANI_TEST_CREATE` + sender/recipient test data
- `ANDREANI_TEST_TRACKING_CODE`

Env vars (secrets):
- Use vault secrets (`MERCADOPAGO`, `ANDREANI`) or fallback to `.env` credentials.

## Official Docs
Mercado Pago:
- API reference + authentication: `https://www.mercadopago.com.br/developers/en/reference` citeturn0search7
- Webhooks signature: `https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks` citeturn0search5

Andreani GlobAllPack:
- Overview + login/auth: `https://developers.andreanigloballpack.com/en/` citeturn1search4
- Cotizador: `https://developers.andreanigloballpack.com/en/Apis/Cotizador/summary/` citeturn1search5
- Preenvio: `https://developers.andreanigloballpack.com/en/Apis/Preenvio/summary/` citeturn1search1
- Trazabilidad: `https://developers.andreanigloballpack.com/Apis/Traza/summary/` citeturn0search3
