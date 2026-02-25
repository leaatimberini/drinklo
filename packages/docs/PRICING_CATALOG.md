# Pricing Catalog (ES/EN)

## ES

### Objetivo
Catálogo de precios del proveedor desacoplado de las suscripciones activas, con:

- precios por `tier` (`C1/C2/C3`)
- período (`MONTHLY`/`YEARLY`)
- moneda (`USD` base y `ARS` referencia, más otras opcionales)
- vigencia (`effectiveFrom` / `effectiveTo`)
- programación de cambios futuros
- historial auditado

### Modelo (control-plane)

`PlanPrice`
- `tier`
- `billingPeriod`
- `currency`
- `amount`
- `effectiveFrom`
- `effectiveTo`
- `notes`
- `createdBy`, `updatedBy`, timestamps

> `BillingPlan` sigue representando el plan operativo/facturable actual. `PlanPrice` es el catálogo de referencia/publicación.

### Política de impacto

Por defecto, un cambio en `PlanPrice` es **CATALOG_ONLY**:
- **no** modifica `BillingAccount`
- **no** modifica `BillingPlan.price`
- **no** altera suscripciones existentes sin política explícita

Esto se expone en API como `impactDefault`.

### Endpoints (control-plane)

- `GET /api/pricing-catalog`
  - listado + snapshot (`current/next`) + auditoría
- `POST /api/pricing-catalog`
  - `action=create|upsert|close`
- `GET /api/pricing-catalog/current`
  - consulta `precio actual` y `próximo`
  - por `tier` o por `instanceId`

Query soportada (`/api/pricing-catalog/current`)
- `tier`
- `instanceId` (infiere tier desde `BillingAccount.plan.name`)
- `billingPeriod` (`MONTHLY|YEARLY`)
- `currency` (opcional; si se omite devuelve por todas las monedas cargadas)
- `at` (fecha de cálculo)

### UI control-plane

Página: `apps/control-plane/app/pricing-catalog/page.tsx`

Permite:
- crear precios actuales o programados
- cerrar vigencias (`effectiveTo`)
- ver snapshot actual/próximo
- ver historial y auditoría (`ComplianceEvidence`)

### Integración con portal/admin

`GET /api/billing/portal` ahora incluye, cuando existe:
- `account.pricingCatalogTier`
- `account.pricingCatalog[]` con `current`/`next` por moneda

### Tests

Se agregan tests unitarios de:
- resolución de precio vigente/próximo por fecha
- política default sin impacto en suscripciones existentes

Archivo:
- `apps/control-plane/app/lib/pricing-catalog.test.ts`

---

## EN

### Goal
Provider-side pricing catalog decoupled from active subscriptions, with:

- prices by `tier` (`C1/C2/C3`)
- billing period (`MONTHLY`/`YEARLY`)
- currency (`USD` base and `ARS` reference, plus optional others)
- validity window (`effectiveFrom` / `effectiveTo`)
- scheduled changes
- auditable history

### Data model (control-plane)

`PlanPrice` stores catalog rows and validity windows. `BillingPlan` remains the operational billing plan object.

### Impact policy

Default behavior is **CATALOG_ONLY**:
- no changes to `BillingAccount`
- no changes to `BillingPlan.price`
- no impact to existing subscriptions unless an explicit propagation policy is added later

### Endpoints

- `GET /api/pricing-catalog`
- `POST /api/pricing-catalog`
- `GET /api/pricing-catalog/current`

`/api/pricing-catalog/current` supports lookup by `tier` or `instanceId`, plus `billingPeriod`, `currency`, and `at`.

### Control-plane UI

- `apps/control-plane/app/pricing-catalog/page.tsx`

Includes editor, scheduled price changes, current/next snapshot, and audit history.

### Portal/admin integration

`GET /api/billing/portal` now returns provider pricing catalog preview (`current` and `next`) for the account tier when catalog rows exist.

### Tests

- current/next effective price resolution by date
- default non-impact behavior for existing subscriptions

