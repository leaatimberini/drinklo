# Developer Portal (ES/EN)

## ES

### Objetivo
Agregar un portal de desarrolladores en `apps/control-plane` para partners/proveedor con:
- catalogo de endpoints,
- guias de auth,
- ejemplos de webhooks,
- troubleshooting,
- publicacion de OpenAPI y changelog.

### Ubicacion
UI en control-plane:
- `/developer-portal`
- `/developer-portal/auth`
- `/developer-portal/webhooks`
- `/developer-portal/troubleshooting`
- `/developer-portal/openapi`
- `/developer-portal/changelog`

### Publicacion OpenAPI
Fuente:
- `packages/shared/contracts/openapi/v1.json`
- `packages/shared/contracts/openapi/v2.json`

Salida generada:
- `apps/control-plane/public/developer-api/openapi/v1.json`
- `apps/control-plane/public/developer-api/openapi/v2.json`
- `apps/control-plane/public/developer-api/v1.catalog.json`
- `apps/control-plane/public/developer-api/v2.catalog.json`
- `apps/control-plane/public/developer-api/index.json`

Script:
- `node scripts/generate-developer-portal.mjs`

### Changelog API
Se genera automaticamente desde `git log` filtrando cambios en:
- `apps/api`
- `packages/shared/contracts/openapi`

Salida:
- `apps/control-plane/public/developer-api/changelog.json`

### "redocly o similar"
Se usa enfoque "similar": generacion automatica de catalogo navegable desde OpenAPI (`*.catalog.json`) + JSON raw publicado.
Esto evita depender de servicios externos y mantiene el portal self-hosted.

### Tests requeridos
En `apps/control-plane/package.json`:
- `developer-portal:test:links`: valida links internos y assets publicados.
- `developer-portal:test:docs`: lint basico de `packages/docs/DEVELOPER_PORTAL.md`.
- `test`: ejecuta `generate + lint + links + docs + build`.

### Comandos
- Generar assets portal:
  - `pnpm -C apps/control-plane developer-portal:generate`
- Validar links:
  - `pnpm -C apps/control-plane developer-portal:test:links`
- Lint docs:
  - `pnpm -C apps/control-plane developer-portal:test:docs`
- Build portal:
  - `pnpm -C apps/control-plane build`

## EN

### Goal
Add a developer portal in `apps/control-plane` for partners/provider with:
- endpoint catalog,
- auth guides,
- webhook examples,
- troubleshooting,
- published OpenAPI and API changelog.

### Location
Control-plane UI routes:
- `/developer-portal`
- `/developer-portal/auth`
- `/developer-portal/webhooks`
- `/developer-portal/troubleshooting`
- `/developer-portal/openapi`
- `/developer-portal/changelog`

### OpenAPI publishing
Source:
- `packages/shared/contracts/openapi/v1.json`
- `packages/shared/contracts/openapi/v2.json`

Generated output:
- `apps/control-plane/public/developer-api/openapi/v1.json`
- `apps/control-plane/public/developer-api/openapi/v2.json`
- `apps/control-plane/public/developer-api/v1.catalog.json`
- `apps/control-plane/public/developer-api/v2.catalog.json`
- `apps/control-plane/public/developer-api/index.json`

Script:
- `node scripts/generate-developer-portal.mjs`

### API changelog
Auto-generated from `git log` for:
- `apps/api`
- `packages/shared/contracts/openapi`

Output:
- `apps/control-plane/public/developer-api/changelog.json`

### "redocly or similar"
Implemented with a "similar" approach: generated, navigable endpoint catalog from OpenAPI (`*.catalog.json`) plus raw JSON specs.
This keeps the portal fully self-hosted.

### Required tests
In `apps/control-plane/package.json`:
- `developer-portal:test:links`: validates internal links and published assets.
- `developer-portal:test:docs`: basic lint of `packages/docs/DEVELOPER_PORTAL.md`.
- `test`: runs `generate + lint + links + docs + build`.

### Commands
- Generate portal assets:
  - `pnpm -C apps/control-plane developer-portal:generate`
- Validate links:
  - `pnpm -C apps/control-plane developer-portal:test:links`
- Lint docs:
  - `pnpm -C apps/control-plane developer-portal:test:docs`
- Build portal:
  - `pnpm -C apps/control-plane build`
