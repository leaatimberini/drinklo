# Quickstart (ES/EN)

## ES

### Objetivo
Levantar el stack local en Windows/Linux/macOS con **un comando** (`pnpm bootstrap`) usando:
- `pnpm` workspaces + Turborepo
- Infra local con Docker Compose
- Prisma en `packages/db`

### Requisitos
- **Node 24 requerido** (minimo `>= 24`)
- Node.js `>= 24`
- `pnpm`
- Docker Desktop / Docker Engine corriendo

### Inicio rapido
1. Instalar dependencias:
   - `pnpm install`
2. (Opcional, recomendado en Windows) Ejecutar diagnostico:
   - `pnpm bootstrap:diag`
3. Levantar todo:
   - `pnpm bootstrap`

El script:
- valida prerequisitos
- detecta un `docker-compose*.yml` con `postgres` (override opcional con `COMPOSE_FILE`)
- levanta infra (`docker compose up -d`)
- espera health de `postgres` y `redis`
- crea `.env` desde `.env.example` en apps conocidas (si existen)
- corre migraciones + seed
- arranca `pnpm -w run dev`

### Detener infraestructura
- `pnpm infra:down`

### Ver logs de infraestructura
- `pnpm infra:logs`

### Reset de base de datos
- `pnpm db:reset`

### Override de compose
- PowerShell:
  - `$env:COMPOSE_FILE='deploy/templates/docker-compose.yml'; pnpm bootstrap`
- Bash:
  - `COMPOSE_FILE=deploy/templates/docker-compose.yml pnpm bootstrap`

### Conflictos de puertos (auto-remap)
- `pnpm bootstrap` ejecuta un preflight de puertos host antes de `docker compose up`.
- Si detecta conflicto (proceso externo o puerto duplicado en compose), genera:
  - `.bootstrap.compose.override.yml`
  - y aplica `docker compose -f <base> -f .bootstrap.compose.override.yml ...`
- Puertos comunes validados:
  - `9000`/`9001` (MinIO API/Console)
  - `5432` (Postgres)
  - `6379` (Redis)
  - `7700` (Meilisearch)
  - `8123` (ClickHouse HTTP)
- Remaps preferidos:
  - `9000 -> 19000`, `9001 -> 19001`, `5432 -> 15432`, `6379 -> 16379`, `7700 -> 17700`, `8123 -> 18123`
- Al finalizar, bootstrap imprime los puertos/URLs finales efectivos.

### Troubleshooting
- **`[bootstrap][error] pnpm exited with null` o error de spawn en Windows**
  - Ejecutar `pnpm bootstrap:diag`
  - Verificar que `pnpm` este en PATH (`where pnpm` en PowerShell / Git Bash)
  - Reabrir terminal despues de instalar Node/pnpm y reintentar
- **Puerto ocupado**
  - El bootstrap intenta remap automatico sin tocar tu compose base.
  - Si queres liberar manualmente: revisar (`docker ps`, `netstat -ano` / `lsof -i`)
  - Si queres forzar puertos fijos: liberar puerto o editar compose/override.
- **Docker no arranca / `docker info` falla**
  - Iniciar Docker Desktop / servicio Docker y reintentar
  - El bootstrap muestra mensaje explicito: `Docker no esta disponible...`
- **Migraciones fallan**
  - Verificar `DATABASE_URL` y que `postgres` este healthy
  - Probar `pnpm db:migrate` manualmente
  - Si el schema local quedo inconsistente: `pnpm db:reset`
- **Prisma P3018 / P3009 en bootstrap**
  - Recovery automatico (solo local/dev):
    - PowerShell: `$env:DEV_RESET_DB='true'; pnpm bootstrap`
    - Bash: `DEV_RESET_DB=true pnpm bootstrap`
  - Recovery manual:
    - `docker compose -f docker-compose.yml down -v`
    - `pnpm -C packages/db exec prisma migrate deploy`
    - `pnpm -C packages/db exec prisma db seed`
- **API arranca en modo seguro durante bootstrap**
  - Bootstrap exporta `API_BOOTSTRAP_SAFE_MODE=true` para evitar bloqueos por modulos enterprise no configurados.
  - Para iniciar API full manualmente: `API_BOOTSTRAP_SAFE_MODE=false pnpm -C apps/api dev`

---

## EN

### Goal
Bring up the local stack on Windows/Linux/macOS with **one command** (`pnpm bootstrap`) using:
- `pnpm` workspaces + Turborepo
- Docker Compose infra
- Prisma in `packages/db`

### Requirements
- **Node 24 required** (minimum `>= 24`)
- Node.js `>= 24`
- `pnpm`
- Docker Desktop / Docker Engine running

### Quick start
1. Install dependencies:
   - `pnpm install`
2. (Optional, recommended on Windows) Run diagnostics:
   - `pnpm bootstrap:diag`
3. Start everything:
   - `pnpm bootstrap`

The script will:
- validate prerequisites
- detect a `docker-compose*.yml` containing `postgres` (optional `COMPOSE_FILE` override)
- start infra (`docker compose up -d`)
- wait for `postgres` and `redis` health
- create `.env` from `.env.example` for known apps (if present)
- run migrations + seed
- start `pnpm -w run dev`

### Stop infra
- `pnpm infra:down`

### Infra logs
- `pnpm infra:logs`

### Reset database
- `pnpm db:reset`

### Compose override
- PowerShell:
  - `$env:COMPOSE_FILE='deploy/templates/docker-compose.yml'; pnpm bootstrap`
- Bash:
  - `COMPOSE_FILE=deploy/templates/docker-compose.yml pnpm bootstrap`

### Port conflicts (auto-remap)
- `pnpm bootstrap` runs host-port preflight before `docker compose up`.
- If a conflict is detected (external process or duplicate compose host port), it generates:
  - `.bootstrap.compose.override.yml`
  - and runs `docker compose -f <base> -f .bootstrap.compose.override.yml ...`
- Common checked ports:
  - `9000`/`9001` (MinIO API/Console)
  - `5432` (Postgres)
  - `6379` (Redis)
  - `7700` (Meilisearch)
  - `8123` (ClickHouse HTTP)
- Preferred remaps:
  - `9000 -> 19000`, `9001 -> 19001`, `5432 -> 15432`, `6379 -> 16379`, `7700 -> 17700`, `8123 -> 18123`
- Bootstrap prints final effective ports/URLs at the end.

### Troubleshooting
- **`[bootstrap][error] pnpm exited with null` or Windows spawn error**
  - Run `pnpm bootstrap:diag`
  - Verify `pnpm` is on PATH (`where pnpm` in PowerShell / Git Bash)
  - Reopen terminal after installing Node/pnpm and retry
- **Port already in use**
  - Bootstrap first tries automatic remap without editing the base compose file.
  - To free manually: check (`docker ps`, `netstat -ano` / `lsof -i`)
  - To keep fixed ports: free them or edit compose/override explicitly.
- **Docker not running / `docker info` fails**
  - Start Docker Desktop / Docker daemon and retry
  - Bootstrap now prints explicit message: `Docker no esta disponible...`
- **Migrations fail**
  - Check `DATABASE_URL` and confirm `postgres` is healthy
  - Run `pnpm db:migrate` manually
  - If local schema is inconsistent: `pnpm db:reset`
- **Prisma P3018 / P3009 during bootstrap**
  - Automatic recovery (local/dev only):
    - PowerShell: `$env:DEV_RESET_DB='true'; pnpm bootstrap`
    - Bash: `DEV_RESET_DB=true pnpm bootstrap`
  - Manual recovery:
    - `docker compose -f docker-compose.yml down -v`
    - `pnpm -C packages/db exec prisma migrate deploy`
    - `pnpm -C packages/db exec prisma db seed`
- **API starts in safe mode during bootstrap**
  - Bootstrap sets `API_BOOTSTRAP_SAFE_MODE=true` to avoid startup blockers from advanced modules.
  - To run full API manually: `API_BOOTSTRAP_SAFE_MODE=false pnpm -C apps/api dev`
