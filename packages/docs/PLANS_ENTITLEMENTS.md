# Plans & Entitlements / Planes y Entitlements

## ES

### Objetivo
Modelo de suscripción por tiers `C1/C2/C3` con:
- `Subscription` por `Company`
- catálogo de `PlanEntitlement`
- `UsageCounter` mensual por instancia

`TRIAL` se modela como estado (`TRIAL_ACTIVE`), no como tier.

### Modelos (Prisma)
- `PlanTier`: `C1 | C2 | C3`
- `SubscriptionStatus`: `TRIAL_ACTIVE | ACTIVE_PAID | PAST_DUE | GRACE | RESTRICTED | CANCELLED`
- `PlanEntitlement`
  - quotas: `ordersMonth`, `apiCallsMonth`, `storageGb`, `pluginsMax`, `branchesMax`, `adminUsersMax`
  - `sloTarget`, `drFrequency`, `supportLevel`
- `Subscription`
  - `currentTier`, `nextTier`, período actual, trial/grace y fechas de pago/cancelación
- `UsageCounter`
  - contadores mensuales por `companyId + periodKey`

### Seed por defecto
Se crean (upsert) entitlements para:
- `C1`
- `C2`
- `C3`

Toda instalación demo creada por seed genera:
- `Subscription.status = TRIAL_ACTIVE`
- `Subscription.currentTier = C1`
- `trialEndAt = now + 30 días`

### Alta de Company (setup)
`POST /setup/initialize` ahora crea automáticamente:
- catálogo de tiers (si no existe)
- `Subscription` inicial con trial de 30 días (timezone BA para cálculo de ventana)

### API (instance/admin/support)
- `GET /admin/plans/catalog`
- `GET /admin/plans/subscription`
- `GET /admin/plans/entitlements`
- `GET /admin/plans/usage/current`
- `GET /admin/support/plans/:companyId/entitlements`
- `POST /admin/support/plans/:companyId/next-tier`

### UI Admin
Página: `/plan-billing`
- muestra tier/estado
- límites (entitlements)
- uso del mes
- fechas de renovación/trial

### Tests
- reproducibilidad de seed/catalog + presencia de migración
- setup crea subscription trial correctamente (wall clock BA)

---

## EN

### Goal
Introduce a tier-based subscription model (`C1/C2/C3`) with:
- `Subscription` per `Company`
- `PlanEntitlement` catalog
- monthly `UsageCounter` per instance

Trial is represented as a subscription status (`TRIAL_ACTIVE`), not a tier.

### Prisma models
- `PlanTier`: `C1 | C2 | C3`
- `SubscriptionStatus`: `TRIAL_ACTIVE | ACTIVE_PAID | PAST_DUE | GRACE | RESTRICTED | CANCELLED`
- `PlanEntitlement`
  - quotas: `ordersMonth`, `apiCallsMonth`, `storageGb`, `pluginsMax`, `branchesMax`, `adminUsersMax`
  - `sloTarget`, `drFrequency`, `supportLevel`
- `Subscription`
  - `currentTier`, `nextTier`, billing/trial/grace timeline fields
- `UsageCounter`
  - monthly counters keyed by `companyId + periodKey`

### Default seed
Seed upserts catalog rows for `C1/C2/C3` and creates demo subscriptions with:
- `status = TRIAL_ACTIVE`
- `currentTier = C1`
- `trialEndAt = now + 30 days`

### Setup flow
`POST /setup/initialize` now auto-creates:
- tier catalog (if missing)
- initial trial subscription (30 days, BA timezone wall-clock preserved)

### API endpoints
- `GET /admin/plans/catalog`
- `GET /admin/plans/subscription`
- `GET /admin/plans/entitlements`
- `GET /admin/plans/usage/current`
- `GET /admin/support/plans/:companyId/entitlements`
- `POST /admin/support/plans/:companyId/next-tier`

### Admin UI
Route: `/plan-billing`
- current tier/status
- quotas
- monthly usage
- renewal/trial dates

