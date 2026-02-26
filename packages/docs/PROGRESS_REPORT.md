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
