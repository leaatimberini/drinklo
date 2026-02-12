# Billing Advanced (ES/EN)

## ES

### Alcance
Se extendió billing/provider + marketplace para soportar:
- trials por pack (7/14/30 días o valor custom)
- pricing dinámico por uso (orders/mes + tiers de GMV)
- portal cliente con upgrade/downgrade, historial y facturas
- enforcer progresivo: warning -> soft limit -> hard limit (solo premium)
- regla de seguridad: **nunca bloquear ventas básicas**

### Modelo de datos (control-plane)
Se agregaron campos:
- `BillingPlan`
  - `trialDays`
  - `includedOrdersPerMonth`
  - `gmvIncludedArs`
  - `overagePerOrderArs`
  - `gmvTiers` (JSON)
- `BillingAccount`
  - `trialEndsAt`
  - `currentPeriodStart` / `currentPeriodEnd`
  - `monthlyOrders` / `monthlyGmvArs`
  - `softLimitedAt` / `hardLimitedAt`
- Nuevos modelos:
  - `BillingUsageRecord`
  - `BillingPlanChange`

Migración: `apps/control-plane/prisma/migrations/20260212_billing_advanced/migration.sql`

### APIs nuevas/extendidas
- `POST /api/billing` (`kind=usage`)
  - ingesta de uso por instancia
  - calcula estimado dinámico + enforcement
- `POST /api/billing` (`kind=changePlan`)
  - upgrade/downgrade con prorrateo
  - registra historial de cambio
- `GET /api/billing/portal`
  - estado de cuenta extendido (plan, trial, uso, warnings, facturas, historial)
- `POST /api/billing/portal`
  - cambio de plan desde portal cliente

### Enforcer
- `apps/api` expone enforcement en `GET /admin/license/enforcement`
- etapas:
  - `warning`: advertencias
  - `soft_limit`: se restringe premium
  - `hard_limit`: se restringe premium severamente
- ventas básicas: siempre permitidas (`basicSalesAllowed=true`)

### Tests
- `apps/api/src/modules/licensing/billing-policy.spec.ts`
  - expiración de trial
  - upgrade de tier por uso (orders/GMV)
  - prorrateo de cambio de plan
- `apps/api/src/modules/licensing/licensing.service.spec.ts`
  - límites soft/hard para premium sin bloquear ventas básicas

---

## EN

### Scope
Billing/provider + marketplace were extended with:
- pack trials (7/14/30 days or custom)
- usage-based dynamic pricing (orders/month + GMV tiers)
- customer portal: upgrade/downgrade, history, invoices
- progressive enforcer: warning -> soft limit -> hard limit (premium only)
- safety rule: **never block core sales**

### Data model (control-plane)
Added fields:
- `BillingPlan`
  - `trialDays`
  - `includedOrdersPerMonth`
  - `gmvIncludedArs`
  - `overagePerOrderArs`
  - `gmvTiers` (JSON)
- `BillingAccount`
  - `trialEndsAt`
  - `currentPeriodStart` / `currentPeriodEnd`
  - `monthlyOrders` / `monthlyGmvArs`
  - `softLimitedAt` / `hardLimitedAt`
- New models:
  - `BillingUsageRecord`
  - `BillingPlanChange`

Migration: `apps/control-plane/prisma/migrations/20260212_billing_advanced/migration.sql`

### New/extended APIs
- `POST /api/billing` (`kind=usage`)
  - usage ingestion per instance
  - dynamic estimate + enforcement
- `POST /api/billing` (`kind=changePlan`)
  - upgrade/downgrade with proration
  - plan-change history
- `GET /api/billing/portal`
  - extended account data (plan, trial, usage, warnings, invoices, history)
- `POST /api/billing/portal`
  - plan change from customer portal

### Enforcer
- `apps/api` endpoint: `GET /admin/license/enforcement`
- stages:
  - `warning`
  - `soft_limit` (premium restricted)
  - `hard_limit` (premium strongly restricted)
- core sales always allowed (`basicSalesAllowed=true`)

### Tests
- `apps/api/src/modules/licensing/billing-policy.spec.ts`
  - trial expiry
  - tier upgrade by usage (orders/GMV)
  - plan-change proration
- `apps/api/src/modules/licensing/licensing.service.spec.ts`
  - premium soft/hard limits while preserving core sales
