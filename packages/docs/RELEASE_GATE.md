# Release Gate

## Purpose
Provide a deterministic, minimal stability check before releasing or continuing work.

## Commands
- `pnpm smoke`: runs DB reset, starts services, and runs E2E smoke tests.
- `pnpm gate`: runs lint + test + build + smoke.

## Smoke Flow
1. `docker compose up -d`
2. `pnpm -C packages/db migrate reset --force` (uses seed)
3. Start `api`, `admin`, `storefront`
4. Wait for:
   - `http://localhost:3001/health`
   - `http://localhost:3002`
   - `http://localhost:3003`
5. Run Playwright E2E tests (`pnpm e2e`)

## Health / Version
- `GET /health` returns `{ ok: true }`
- `GET /version` returns commit hash and build date from env:
  - `GIT_COMMIT`
  - `BUILD_DATE`

## Environment
- `DATABASE_URL` is taken from env or defaults to:
  `postgresql://erp:erp@localhost:5432/erp?schema=public`

## Files
- `scripts/smoke.mjs`
- `tests/e2e/smoke.spec.ts`
- `playwright.config.ts`
- `apps/api/src/modules/health/*`
