# Restricted Mode (ES/EN)

## ES

### Objetivo
Definir y aplicar el modo `RESTRICTED` de suscripción **sin perder la cuenta ni borrar datos**:
- admin en lectura + exportación (edición limitada)
- storefront configurable:
  - `catalog-only` (checkout deshabilitado)
  - `allow-basic-sales` (ventas básicas permitidas)
- API pública: solo lectura + rate limit duro
- automatizaciones / integraciones de escritura pausadas
- bot: solo consultas (mutaciones bloqueadas vía API)

### Configuración
- `CompanySettings.restrictedModeVariant`
  - `CATALOG_ONLY`
  - `ALLOW_BASIC_SALES` (default)

### Enforcement (API)
- Guard global: `SubscriptionGuard`
  - archivo: `apps/api/src/modules/plans/subscription.guard.ts`
- Aplica política por endpoint/scope (clasificación por ruta+método).
- Devuelve error estructurado:
  - `code = SUBSCRIPTION_RESTRICTED`
  - mensaje explicativo
  - CTA `Actualizar plan`

### Qué se bloquea en RESTRICTED (default)
- `ADMIN` writes no esenciales (lectura/export habilitados)
- `MARKETING_AUTOMATION` writes
- `INTEGRATIONS` writes/sync
- `DEVELOPER_API` writes
- `BOT` mutaciones (si pasan por API)
- `STOREFRONT_CHECKOUT`
  - bloqueado solo en `CATALOG_ONLY`
  - permitido en `ALLOW_BASIC_SALES` para operaciones básicas de checkout

### API pública (Developer API)
- Se mantiene lectura.
- Se aplica **rate limit duro** adicional por compañía+IP (además del rate limit de la API key).

### Logs y auditoría
- Cada bloqueo:
  - log estructurado (`subscription_restricted_block`)
  - `ImmutableAuditLog` (`subscription.restricted.block`)
- Sin PII en payload de auditoría (solo scope/ruta/método/razón/variant/source).

### UI
- Admin:
  - banner global en layout
  - `Plan y Facturación` permite elegir variante de `RESTRICTED`
- Storefront:
  - banner global
  - checkout muestra UX coherente y deshabilita acciones en `catalog-only`

### Endpoints útiles
- `GET /admin/plans/restricted-mode`
- `POST /admin/plans/restricted-mode`
- `POST /admin/support/plans/:companyId/restricted-mode`

### Tests
- Guard API: bloqueo de writes, checkout por variante, API pública rate limit
- Storefront: helper de bloqueo de checkout + parseo de error UX

---

## EN

### Goal
Implement `RESTRICTED` subscription mode without data loss:
- admin read/export allowed, limited edits
- storefront configurable (`catalog-only` vs `allow-basic-sales`)
- public API read-only + hard rate limit
- marketing automation and integration writes paused
- bot mutation commands blocked through API

### Configuration
- `CompanySettings.restrictedModeVariant`
  - `CATALOG_ONLY`
  - `ALLOW_BASIC_SALES` (default)

### Enforcement
- Global Nest guard: `SubscriptionGuard`
- Route+method scope classification
- Structured error payload with `SUBSCRIPTION_RESTRICTED` + upgrade CTA

### Auditing
Each blocked action is logged and appended to immutable audit (without PII).

