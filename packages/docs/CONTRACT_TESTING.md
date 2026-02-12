# Contract Testing (ES/EN)

## ES

### Objetivo
Evitar rupturas silenciosas entre `apps/api` y clientes (`apps/admin`, `apps/storefront`, `apps/mobile`, `apps/bot`).

### Qué se implementó
- OpenAPI contractual versionado:
  - `packages/shared/contracts/openapi/v1.json`
  - `packages/shared/contracts/openapi/v2.json`
  - baseline para breaking detection: `packages/shared/contracts/openapi/v1.baseline.json`
- Política de versiones y deprecación:
  - `packages/shared/contracts/api-version-policy.json`
- Compatibilidad de eventos:
  - baseline `packages/shared/contracts/events/v1.json`
- Scripts automáticos:
  - `pnpm contract:generate`
  - `pnpm contract:test`

### Reglas validadas automáticamente
1. Contrato API vs clientes:
- Se extraen endpoints usados por admin/storefront/mobile/bot desde código.
- Se valida que existan en OpenAPI v1.

2. Breaking changes sin bump mayor:
- Se compara `v1.baseline.json` vs `v1.json`.
- Si se elimina path/método y no sube major en `apps/api/package.json`, falla.

3. Eventos backward compatible:
- Los eventos y campos obligatorios de baseline v1 deben mantenerse.
- Se permite agregar eventos/campos, no quitar existentes.

### Versionado y deprecación (v1/v2)
- Header soportado: `x-api-version` (también `?apiVersion=`).
- Versiones soportadas: definidas en `api-version-policy.json`.
- Si la versión está deprecada (ej. v1): la API responde headers:
  - `Deprecation: true`
  - `Sunset: <fecha>`
  - `Link: </docs/v2>; rel="successor-version"`
- Docs Swagger:
  - `/docs` (default)
  - `/docs/v1`
  - `/docs/v2`

### Flujo recomendado de cambio
1. Hacer cambios en controllers/DTOs.
2. Ejecutar `pnpm contract:generate`.
3. Ejecutar `pnpm contract:test`.
4. Si no hay breakings, merge normal.
5. Si hay breaking intencional:
- subir major de `apps/api/package.json`
- regenerar baseline v1 según estrategia de release.

---

## EN

### Goal
Prevent silent breaking changes between `apps/api` and clients (`apps/admin`, `apps/storefront`, `apps/mobile`, `apps/bot`).

### Implemented
- Versioned OpenAPI contracts:
  - `packages/shared/contracts/openapi/v1.json`
  - `packages/shared/contracts/openapi/v2.json`
  - baseline for breaking detection: `packages/shared/contracts/openapi/v1.baseline.json`
- Versioning/deprecation policy:
  - `packages/shared/contracts/api-version-policy.json`
- Event compatibility baseline:
  - `packages/shared/contracts/events/v1.json`
- Automated scripts:
  - `pnpm contract:generate`
  - `pnpm contract:test`

### Automatically validated rules
1. API contract vs clients:
- Endpoints used by admin/storefront/mobile/bot are extracted from source.
- They must exist in OpenAPI v1.

2. No breaking changes without major bump:
- `v1.baseline.json` is compared to `v1.json`.
- If a path/method is removed and API major is not bumped in `apps/api/package.json`, check fails.

3. Backward-compatible event schemas:
- Baseline v1 event names and required envelope fields must remain.
- Additive changes are allowed, removals are not.

### API versioning and deprecation (v1/v2)
- Supported header: `x-api-version` (also `?apiVersion=`).
- Supported versions are defined in `api-version-policy.json`.
- If a version is deprecated (e.g. v1), API returns:
  - `Deprecation: true`
  - `Sunset: <date>`
  - `Link: </docs/v2>; rel="successor-version"`
- Swagger docs:
  - `/docs` (default)
  - `/docs/v1`
  - `/docs/v2`

### Recommended change flow
1. Update controllers/DTOs.
2. Run `pnpm contract:generate`.
3. Run `pnpm contract:test`.
4. If no breakings: merge.
5. For intentional breaking changes:
- bump API major in `apps/api/package.json`
- regenerate/re-baseline according to release strategy.
