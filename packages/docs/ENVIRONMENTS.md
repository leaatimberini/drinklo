# Environments

This repo supports **development**, **staging**, and **production** profiles. The API validates env vars at boot using a Zod schema (`apps/api/src/modules/config/env.schema.ts`).

## Env examples
- `apps/api/.env.example`: dev defaults
- `apps/api/.env.staging.example`: staging profile
- `apps/api/.env.production.example`: production profile
- `apps/admin/.env.staging.example`, `apps/admin/.env.production.example`
- `apps/storefront/.env.staging.example`, `apps/storefront/.env.production.example`
- `apps/bot/.env.staging.example`, `apps/bot/.env.production.example`

## Required envs (API)
Minimum required keys for the API to boot:
- `NODE_ENV`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

## Runtime flags
These flags are validated and used at runtime:
- `PAYMENT_SANDBOX`: when `true`, Mercado Pago uses sandbox init points (test credentials).
- `AFIP_SANDBOX`: when `true`, forces ARCA (ex AFIP) env to `HOMO` regardless of `CompanySettings.afipEnvironment`.
- `INTEGRATIONS_MOCK`: when `true`, integrations return mock responses (e.g. Andreani quote) to avoid external calls.

## Feature flags (CompanySettings)
Each company can enable/disable modules at runtime via `CompanySettings`:
- `enableAfip`
- `enableMercadoLibre`
- `enableRappi`
- `enablePedidosYa`
- `enableAndreani`
- `enableOwnDelivery`

These are stored per company and can be toggled from admin (or via DB admin tooling). API services read them to allow or block module behavior.

## Staging vs Production
Recommended defaults:
- **Staging**: `PAYMENT_SANDBOX=true`, `AFIP_SANDBOX=true`, `INTEGRATIONS_MOCK=true`
- **Production**: `PAYMENT_SANDBOX=false`, `AFIP_SANDBOX=false`, `INTEGRATIONS_MOCK=false`

## Notes
- Ensure `CORS_ORIGINS` matches the deployed admin/storefront URLs.
- Provide valid `AFIP_CERT_PATH` and `AFIP_KEY_PATH` only in environments where ARCA (ex AFIP) is enabled.
- `MERCADOPAGO_ACCESS_TOKEN` must be a test token in staging and a production token in production.
