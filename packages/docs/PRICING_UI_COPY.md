# Pricing UI & Copy (ES/EN)

## ES

### Objetivo
Experiencia self-serve para pricing y billing management en `admin` y `storefront`.

### Rutas
- Admin:
  - `/pricing`
  - `/billing/manage`
- Storefront:
  - `/pricing`
  - `/billing/manage`

### Contenido mínimo (implementado)
- Comparativa `C1 / C2 / C3` con límites y beneficios
- Estado actual de suscripción (requiere JWT admin para datos de instancia)
- Uso y límites del mes
- Upgrade inmediato
- Downgrade al próximo ciclo
- Método de pago (si aplica) vía portal de billing provider (control-plane)
- Copy legal:
  - trial 30 días
  - grace + restricted
  - aclaración explícita de no borrado de datos en restricted
  - consentimiento marketing separado (opt-in independiente)

### Integración de datos
- Instance API (autogestión real):
  - `/admin/plans/catalog`
  - `/admin/plans/entitlements`
  - `/billing/upgrade`
  - `/billing/downgrade`
- Provider billing portal (opcional):
  - `/api/billing/portal`
  - `/api/billing/invoices/:id/pay`

### Tests UI (básicos)
Se implementan snapshots de configuración UI + navegación (view-model), no render visual completo:
- `apps/admin/app/self-serve-ui-content.test.ts`
- `apps/storefront/app/self-serve-ui-content.test.ts`

## EN

### Goal
Self-serve pricing and billing management UX in both admin and storefront.

### Routes
- Admin: `/pricing`, `/billing/manage`
- Storefront: `/pricing`, `/billing/manage`

### Implemented UX
- C1/C2/C3 comparison
- Current subscription state and monthly usage/limits
- Immediate upgrade
- Next-cycle downgrade
- Payment method section (when provider billing portal is configured)
- Legal copy for trial/grace/restricted and separate marketing consent

### Tests
Basic UI snapshot/navigation tests using page config objects (view-model level).

