# Billing E2E (ES/EN)

## ES

### Objetivo
Suite E2E (Playwright) para validar flujos de billing/trial/lifecycle en:

- **instancia** (`apps/api`, `apps/admin`, `apps/storefront`)
- **control-plane** (`apps/control-plane`) para signup/campañas de trial

Archivo principal:
- `tests/e2e/billing.spec.ts`

### Casos cubiertos

1. Alta sin campaña (control-plane direct billing account) con trial ~30 días y plan base `C1`
2. Alta con campaña (`/api/signup?trial=CODE`) con `durationDays` + atribución (`utm/referral`)
3. `TRIAL_ACTIVE -> GRACE -> RESTRICTED` + bloqueo de writes + checkout en modo catálogo
4. Upgrade durante trial (cambio de tier inmediato, sin marcar pago)
5. Conversión a pago (mock/determinística) -> `ACTIVE_PAID` + entitlements
6. Downgrade programado -> aplicación al próximo ciclo + soft limits (sin borrar data)
7. `PAST_DUE -> GRACE -> RESTRICTED`

### Requisitos / Variables de entorno

Obligatorias (para tests mutantes):

- `BILLING_E2E_ENABLE_MUTATIONS=true`
- `BILLING_E2E_DATABASE_URL` (o `DATABASE_URL`) -> DB de la instancia

Opcionales (control-plane cases 1/2):

- `BILLING_E2E_CONTROL_PLANE_DATABASE_URL` (o `CONTROL_PLANE_DATABASE_URL`)
- `BILLING_E2E_CONTROL_PLANE_ADMIN_TOKEN` (o `CONTROL_PLANE_ADMIN_TOKEN`)

URLs (defaults locales):

- `BILLING_E2E_API_URL` (default `http://localhost:3001`)
- `BILLING_E2E_ADMIN_URL` (default `http://localhost:3002`)
- `BILLING_E2E_STOREFRONT_URL` (default `http://localhost:3003`)
- `BILLING_E2E_CONTROL_PLANE_URL` (default `http://localhost:3010`)

Credenciales API instancia (seed demo):

- `BILLING_E2E_ADMIN_EMAIL` (default `admin@acme.local`)
- `BILLING_E2E_ADMIN_PASSWORD` (default `admin123`)

### Ejecución local

```bash
pnpm exec playwright test tests/e2e/billing.spec.ts
```

### CI (staging profile con mocks)

Se agrega job opcional en `ci.yml`:
- corre sólo si existen secrets/vars de staging billing E2E
- asume entorno staging configurado con mocks:
  - `PAYMENT_SANDBOX=true`
  - `AFIP_SANDBOX=true`
  - `INTEGRATIONS_MOCK=true`

### Nota de diseño

Algunos casos usan **fixtures determinísticas por DB (Prisma)** para controlar tiempo/estado de suscripción (trial/grace/past_due) y evitar dependencia de reloj real o webhooks externos en CI.

---

## EN

### Goal
Playwright E2E coverage for billing/trial/subscription lifecycle flows across:

- **instance** apps (`apps/api`, `apps/admin`, `apps/storefront`)
- **control-plane** (`apps/control-plane`) for trial campaign signups

Primary file:
- `tests/e2e/billing.spec.ts`

### Covered scenarios

1. Signup without campaign (control-plane direct billing account) -> ~30-day base trial `C1`
2. Campaign signup -> trial duration + attribution persisted
3. `TRIAL_ACTIVE -> GRACE -> RESTRICTED` + write blocking + storefront catalog-only checkout UX
4. Upgrade during trial (tier updates immediately, payment not yet settled)
5. Convert to paid (mock/deterministic) -> `ACTIVE_PAID` + entitlements
6. Scheduled downgrade -> applied next cycle + soft limits (no data deletion)
7. `PAST_DUE -> GRACE -> RESTRICTED`

### Environment variables

Required for mutating instance tests:

- `BILLING_E2E_ENABLE_MUTATIONS=true`
- `BILLING_E2E_DATABASE_URL` or `DATABASE_URL`

Optional for control-plane signup/campaign tests:

- `BILLING_E2E_CONTROL_PLANE_DATABASE_URL` or `CONTROL_PLANE_DATABASE_URL`
- `BILLING_E2E_CONTROL_PLANE_ADMIN_TOKEN` or `CONTROL_PLANE_ADMIN_TOKEN`

### Run locally

```bash
pnpm exec playwright test tests/e2e/billing.spec.ts
```

### CI (staging profile with mocks)

The CI workflow includes an optional `billing-e2e-staging` job that runs only when staging secrets are present and expects mock integrations enabled in the target staging environment.

### Design note

Several scenarios use **deterministic DB fixtures (Prisma)** to control subscription timestamps/states and keep CI stable without real payment/ARCA/Andreani callbacks.

