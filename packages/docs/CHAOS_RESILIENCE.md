# Chaos & Resilience

## ES

## Objetivo
Agregar validacion de resiliencia en staging mediante fault injection controlado y reportes en control-plane.

## Escenarios de fault injection
Script principal:
- `pnpm chaos:staging`
- Archivo: `scripts/chaos-resilience.mjs`

Escenarios soportados:
- `redis_down`
- `db_latency`
- `storage_loss`
- `webhooks_duplicated`

Cada escenario usa comandos por entorno:
- `CHAOS_REDIS_DOWN_CMD`, `CHAOS_REDIS_RECOVER_CMD`
- `CHAOS_DB_LATENCY_CMD`, `CHAOS_DB_LATENCY_RECOVER_CMD`
- `CHAOS_STORAGE_LOSS_CMD`, `CHAOS_STORAGE_RECOVER_CMD`
- `CHAOS_WEBHOOK_DUPLICATE_CMD`, `CHAOS_WEBHOOK_DUPLICATE_RECOVER_CMD`

## Medicion de SLOs y rollback canary
Se extendio `scripts/blue-green-canary.mjs` con chequeo automatico SLO post-step:
- fuente: `BLUEGREEN_METRICS_URL` (Prometheus text)
- umbrales:
  - `BLUEGREEN_SLO_P95_MAX`
  - `BLUEGREEN_SLO_ERROR_RATE_MAX`
  - `BLUEGREEN_SLO_WEBHOOK_RETRY_RATE_MAX`

Si hay breach, el script falla y ejecuta rollback usando `BLUEGREEN_ROLLBACK_CMD`.

## Reporte a control-plane
Nuevo ingest endpoint:
- `POST /api/chaos/report`
- auth: header `x-cp-ingest-token` (`CONTROL_PLANE_INGEST_TOKEN`)

Consulta de tendencias:
- `GET /api/chaos/results?days=30&instanceId=...`
- auth admin (`x-cp-admin-token` o cookie de admin)

Persistencia:
- `ChaosRun` en control-plane DB (escenario, estado, SLO snapshot, duracion, detalles).

UI control-plane:
- Home: resumen de ejecuciones recientes.
- Detalle de instalacion: listado de chaos runs por instancia.

## Variables recomendadas
- `CHAOS_ENVIRONMENT=staging`
- `CHAOS_METRICS_URL=http://staging-api:3001/metrics`
- `CHAOS_HEALTH_URL=http://staging-api:3001/health`
- `CHAOS_SLO_P95_MAX=1500`
- `CHAOS_SLO_ERROR_RATE_MAX=0.02`
- `CHAOS_SLO_WEBHOOK_RETRY_RATE_MAX=0.05`
- `CONTROL_PLANE_URL=https://control-plane.staging.example.com`
- `CONTROL_PLANE_INGEST_TOKEN=...`

## Ejemplo
```bash
CHAOS_REDIS_DOWN_CMD="docker stop erp-redis" \
CHAOS_REDIS_RECOVER_CMD="docker start erp-redis" \
CHAOS_DB_LATENCY_CMD="echo inject db latency" \
CHAOS_DB_LATENCY_RECOVER_CMD="echo recover db latency" \
CHAOS_STORAGE_LOSS_CMD="echo inject storage fault" \
CHAOS_STORAGE_RECOVER_CMD="echo recover storage fault" \
CHAOS_WEBHOOK_DUPLICATE_CMD="echo trigger duplicate webhook" \
CHAOS_WEBHOOK_DUPLICATE_RECOVER_CMD="echo done" \
pnpm chaos:staging
```

## Test
- `tests/e2e/chaos-resilience.spec.ts`
  - valida endpoint de tendencias en control-plane (con envs).

---

## EN

## Goal
Add staging resilience validation with controlled fault injection and central reporting.

## Fault injection suite
Main script:
- `pnpm chaos:staging`
- `scripts/chaos-resilience.mjs`

Scenarios:
- `redis_down`
- `db_latency`
- `storage_loss`
- `webhooks_duplicated`

Each scenario is command-driven via env vars (inject + recover).

## SLO measurement and auto rollback in canary
`scripts/blue-green-canary.mjs` now enforces SLO checks after each canary step:
- metrics source: `BLUEGREEN_METRICS_URL`
- thresholds:
  - `BLUEGREEN_SLO_P95_MAX`
  - `BLUEGREEN_SLO_ERROR_RATE_MAX`
  - `BLUEGREEN_SLO_WEBHOOK_RETRY_RATE_MAX`

If breach is detected, rollout fails and rollback command is executed.

## Control-plane reporting
- `POST /api/chaos/report` (ingest token)
- `GET /api/chaos/results` (admin auth)

Stored as `ChaosRun` records with scenario status and SLO snapshot.

## UI
- Home shows latest chaos runs.
- Installation detail shows per-instance run history.
