# Progress Report (ES/EN)

## ES

### Resumen
Se agregó un **Quickstart/Installer local** para levantar el monorepo con un comando:
- `pnpm bootstrap`

Incluye:
- detección automática de compose dev (con override `COMPOSE_FILE`)
- arranque de infraestructura Docker
- wait de health (`postgres`, `redis`)
- creación de `.env` desde `.env.example`
- migraciones + seed Prisma
- arranque de `pnpm -w run dev`

### Scripts nuevos/actualizados
- `scripts/bootstrap.ps1`
- `scripts/bootstrap.sh`
- `scripts/bootstrap.mjs`
- `scripts/bootstrap-core.mjs`
- `scripts/infra.mjs`
- `scripts/quickstart-lib.mjs`

### Scripts root agregados
- `bootstrap`
- `infra:up`
- `infra:down`
- `infra:logs`
- `db:migrate`
- `db:seed`
- `db:reset`

### Cómo probar
1. `pnpm install`
2. `pnpm bootstrap`
3. Validar URLs impresas al final y login demo (si seed lo define)
4. Detener infra: `pnpm infra:down`
5. Reset DB (opcional): `pnpm db:reset`

### Calidad mínima agregada
- Test de `env schema` en API para asegurar que falle si falta `DATABASE_URL`.

### Fixes posteriores (gate/CI)
- Corrección de lint preexistente en:
  - `packages/shared/src/event-model.ts` (tipado `unknown`/guard, sin cambio funcional)
  - `apps/customer-portal/app/page.tsx` (tipos explícitos para billing portal data)
- Ajuste de CI en `.github/workflows/ci.yml`:
  - `actions/setup-node` usa `24.x`
  - cache `pnpm` con `cache-dependency-path: pnpm-lock.yaml`
  - `pnpm/action-setup` fijado a `9.15.0`
- Validación ejecutada:
  - `pnpm -C packages/shared lint` ✅
  - `pnpm -C apps/customer-portal lint` ✅
  - `pnpm lint` ❌ (aparecen más fallas preexistentes fuera del alcance inicial, principalmente en `apps/storefront`)

### Validación adicional (branch `feature/132-fix-gate-node24`)
- `pnpm -C apps/api test -- src/modules/config/env.schema.spec.ts` ✅
- `pnpm lint` ❌
  - bloquea en `apps/storefront` con errores preexistentes (`no-explicit-any`, `react/no-unescaped-entities`)
- `pnpm gate` ❌ (frena en etapa `lint` por el punto anterior)
- Estado:
  - Los fixes solicitados (`packages/shared/src/event-model.ts`, `apps/customer-portal/app/page.tsx`) están aplicados y verdes.
  - CI ya usa Node `24.x`, pero el gate completo requiere corregir lint adicional fuera de alcance inicial.

---

## EN

### Summary
A local **Quickstart/Installer** was added to boot the monorepo with one command:
- `pnpm bootstrap`

It includes:
- automatic dev compose detection (with `COMPOSE_FILE` override)
- Docker infra startup
- health wait (`postgres`, `redis`)
- `.env` creation from `.env.example`
- Prisma migrations + seed
- `pnpm -w run dev` startup

### New/updated scripts
- `scripts/bootstrap.ps1`
- `scripts/bootstrap.sh`
- `scripts/bootstrap.mjs`
- `scripts/bootstrap-core.mjs`
- `scripts/infra.mjs`
- `scripts/quickstart-lib.mjs`

### Root scripts added
- `bootstrap`
- `infra:up`
- `infra:down`
- `infra:logs`
- `db:migrate`
- `db:seed`
- `db:reset`

### How to test
1. `pnpm install`
2. `pnpm bootstrap`
3. Validate printed URLs and demo credentials (if defined by seed)
4. Stop infra: `pnpm infra:down`
5. Reset DB (optional): `pnpm db:reset`

### Minimum quality coverage
- API `env schema` test ensuring failure when `DATABASE_URL` is missing.

### Follow-up fixes (gate/CI)
- Fixed pre-existing lint failures in:
  - `packages/shared/src/event-model.ts` (`unknown` typing + guard, no behavior change)
  - `apps/customer-portal/app/page.tsx` (explicit billing portal response types)
- Updated CI in `.github/workflows/ci.yml`:
  - `actions/setup-node` uses `24.x`
  - stable pnpm cache with `cache-dependency-path: pnpm-lock.yaml`
  - `pnpm/action-setup` pinned to `9.15.0`
- Validation run:
  - `pnpm -C packages/shared lint` ✅
  - `pnpm -C apps/customer-portal lint` ✅
  - `pnpm lint` ❌ (additional pre-existing lint issues surfaced outside the initial scope, mainly in `apps/storefront`)

### Additional validation (branch `feature/132-fix-gate-node24`)
- `pnpm -C apps/api test -- src/modules/config/env.schema.spec.ts` ✅
- `pnpm lint` ❌
  - blocked by pre-existing `apps/storefront` lint issues (`no-explicit-any`, `react/no-unescaped-entities`)
- `pnpm gate` ❌ (stops at `lint` due to the issue above)
- Status:
  - Requested fixes (`packages/shared/src/event-model.ts`, `apps/customer-portal/app/page.tsx`) are applied and lint-clean.
  - CI already uses Node `24.x`, but full gate still needs additional lint cleanup outside the initial scope.
