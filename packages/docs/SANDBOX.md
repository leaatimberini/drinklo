# Sandbox (ES/EN)

## ES

### Objetivo
Soportar modo sandbox por company para pruebas repetibles sin tocar datos reales.

Incluye:
- aislamiento por `companyId` en reset/seed,
- integraciones simuladas deterministas (Mercado Pago, Andreani, ARCA),
- herramienta `sandbox-reset` desde Admin y Control Plane,
- harness E2E para flujo completo.

### Modelo operativo
`CompanySettings` agrega:
- `sandboxMode: boolean`
- `sandboxResetAt: DateTime?`

Aislamiento elegido (segun arquitectura actual):
- **company-level isolation** (`companyId` scoping) en purge/reset/seed.
- No requiere DB/schema fisica separada para operar sandbox por tenant.

### Endpoints API (admin)
Requieren JWT + permiso `settings:write`.

- `GET /admin/sandbox/status`
- `POST /admin/sandbox/mode` body `{ sandboxMode: boolean }`
- `POST /admin/sandbox/reset`
- `POST /admin/sandbox/simulate-payment/:orderId`

### Integraciones simuladas deterministas
Cuando `sandboxMode=true`:
- Mercado Pago (`PaymentsService.createPreference`):
  - `preferenceId = sbx-pref-<orderId>`
  - `initPoint = https://sandbox.local/pay/<orderId>`
- Andreani (`ShippingService.quote` con provider ANDREANI):
  - opciones de envio calculadas de forma estable por postal code.
- ARCA (`BillingService.createInvoice`):
  - CAE/numero simulados y estables por referencia.
  - se registra `AfipLog` con `service=ARCA_SANDBOX`.

### Sandbox Reset
`POST /admin/sandbox/reset`:
- limpia datos transaccionales y catalogo del tenant,
- re-seedea baseline sandbox:
  - categoria + lista de precios,
  - 3 productos demo con stock,
  - zona de envio,
- fuerza `billingMode=NO_FISCAL` y `enableAfip=false`.

### Tool en Admin
UI:
- `apps/admin/app/sandbox/page.tsx`

Acciones:
- activar/desactivar sandbox,
- reset a baseline,
- ver estado.

### Tool en Control Plane
UI:
- `apps/control-plane/app/sandbox/page.tsx`

API:
- `POST /api/sandbox/reset`

Request:
- `instanceId`
- `adminToken`
- `apiBaseUrl` opcional

### Test Harness E2E
Scripts:
- `pnpm sandbox:harness`
- `pnpm sandbox:harness:all`

`sanbox:harness` ejecuta:
1. reset sandbox
2. lectura catalogo (storefront)
3. cotizacion ANDREANI simulada
4. creacion de orden
5. preferencia de pago simulada
6. aprobacion de pago simulada
7. facturacion NO_FISCAL

### Tests
- `apps/api/src/modules/sandbox/sandbox.service.spec.ts`
  - aislamiento (operaciones scoped por `companyId`)
  - determinismo de mocks

## EN

### Goal
Provide per-company sandbox mode for repeatable testing without touching real tenant data.

Includes:
- tenant isolation by `companyId` in reset/seed,
- deterministic simulated integrations (Mercado Pago, Andreani, ARCA),
- `sandbox-reset` tool in Admin and Control Plane,
- E2E harness script for full flow validation.

### Operating model
`CompanySettings` adds:
- `sandboxMode: boolean`
- `sandboxResetAt: DateTime?`

Isolation strategy for current architecture:
- **company-level isolation** (`companyId` scoped reset/seed).
- No physical dedicated DB/schema required for tenant sandbox operations.

### API endpoints (admin)
Require JWT + `settings:write` permission.

- `GET /admin/sandbox/status`
- `POST /admin/sandbox/mode` body `{ sandboxMode: boolean }`
- `POST /admin/sandbox/reset`
- `POST /admin/sandbox/simulate-payment/:orderId`

### Deterministic simulated integrations
When `sandboxMode=true`:
- Mercado Pago (`PaymentsService.createPreference`):
  - `preferenceId = sbx-pref-<orderId>`
  - `initPoint = https://sandbox.local/pay/<orderId>`
- Andreani (`ShippingService.quote` for ANDREANI provider):
  - stable shipping options derived from postal code.
- ARCA (`BillingService.createInvoice`):
  - deterministic simulated CAE/invoice number.
  - logs to `AfipLog` with `service=ARCA_SANDBOX`.

### Sandbox Reset
`POST /admin/sandbox/reset`:
- clears tenant transactional/catalog data,
- re-seeds sandbox baseline:
  - category + price list,
  - 3 demo products with stock,
  - shipping zone,
- forces `billingMode=NO_FISCAL` and `enableAfip=false`.

### Admin Tool
UI:
- `apps/admin/app/sandbox/page.tsx`

Actions:
- enable/disable sandbox,
- reset to baseline,
- inspect sandbox status.

### Control Plane Tool
UI:
- `apps/control-plane/app/sandbox/page.tsx`

API:
- `POST /api/sandbox/reset`

Request:
- `instanceId`
- `adminToken`
- optional `apiBaseUrl`

### E2E Harness
Scripts:
- `pnpm sandbox:harness`
- `pnpm sandbox:harness:all`

Flow covered:
1. sandbox reset
2. storefront catalog read
3. simulated ANDREANI quote
4. order creation
5. simulated payment preference
6. simulated payment approval
7. NO_FISCAL invoice

### Tests
- `apps/api/src/modules/sandbox/sandbox.service.spec.ts`
  - data isolation by `companyId`
  - deterministic mock outputs
