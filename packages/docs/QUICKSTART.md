# Quickstart (ES/EN)

## ES

### Objetivo
Levantar el stack local en Windows/Linux/macOS con **un comando** (`pnpm bootstrap`) usando:
- `pnpm` workspaces + Turborepo
- Infra local con Docker Compose
- Prisma en `packages/db`

### Requisitos
- **Node 24 requerido** (mínimo `>= 24`)
- Node.js `>= 24`
- `pnpm`
- Docker Desktop / Docker Engine corriendo

### Inicio rápido
1. Instalar dependencias:
   - `pnpm install`
2. Levantar todo:
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

### Troubleshooting
- **Puerto ocupado**
  - Revisar contenedores y procesos locales (`docker ps`, `netstat -ano` / `lsof -i`)
  - Cambiar puertos en `.env` o en el compose
- **Docker no arranca / `docker info` falla**
  - Iniciar Docker Desktop / servicio Docker y reintentar
- **Migraciones fallan**
  - Verificar `DATABASE_URL` y que `postgres` esté healthy
  - Probar `pnpm db:migrate` manualmente
  - Si el schema local quedó inconsistente: `pnpm db:reset`

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
2. Start everything:
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

### Troubleshooting
- **Port already in use**
  - Check containers and local processes (`docker ps`, `netstat -ano` / `lsof -i`)
  - Change ports in `.env` or compose file
- **Docker not running / `docker info` fails**
  - Start Docker Desktop / Docker daemon and retry
- **Migrations fail**
  - Check `DATABASE_URL` and confirm `postgres` is healthy
  - Run `pnpm db:migrate` manually
  - If local schema is inconsistent: `pnpm db:reset`
