# Blue/Green + Canary (ES)

## Objetivo
Habilitar despliegue por instancia con stack paralelo (green), canary progresivo y rollback automático por degradación SLO.

## Flujo por instancia (agent)
1. `backup`
2. `pull`
3. `green_up` (levanta stack green)
4. `migrate_safe`
5. `smoke`
6. Canary por pasos (`5% -> 25% -> 100%` por defecto)
7. `switch_green` (switch final de proxy)
8. `health`

Si hay breach de SLO durante canary, ejecuta rollback inmediato.

## Configuración agent
Variables principales:
- `UPDATE_GREEN_UP_CMD`
- `UPDATE_MIGRATE_SAFE_CMD`
- `UPDATE_SMOKE_CMD`
- `UPDATE_PROXY_SHIFT_CMD` (usa `UPDATE_CANARY_PERCENT`)
- `UPDATE_PROXY_SWITCH_GREEN_CMD`
- `UPDATE_ROLLBACK_CMD`
- `UPDATE_METRICS_URL`
- `UPDATE_CANARY_STEPS` (ej: `5,25,100`)
- `UPDATE_CANARY_STEP_WAIT_SEC`
- `UPDATE_SLO_P95_MAX`
- `UPDATE_SLO_ERROR_RATE_MAX`
- `UPDATE_SLO_WEBHOOK_RETRY_RATE_MAX`

## Control-plane
### Rollout strategy
Nuevo strategy en rollout:
- `BATCH`
- `BLUE_GREEN_CANARY`

Parámetros guardados por rollout:
- `canarySteps`
- `canaryStepWaitSec`
- thresholds SLO
- `autoRollback`

### UI
`/rollouts`:
- Programar rollout con estrategia canary.
- Ver jobs y métricas en tiempo real por etapa (`canaryPercent`, `p95`, `error rate`, `webhook retry`).

## Script operativo
Comando manual:
- `pnpm deploy:bluegreen`

Usa `scripts/blue-green-canary.mjs` con comandos por env.

---

# Blue/Green + Canary (EN)

## Goal
Enable per-instance deployment with parallel stack (green), progressive canary and automatic rollback on SLO degradation.

## Per-instance flow (agent)
1. `backup`
2. `pull`
3. `green_up` (start green stack)
4. `migrate_safe`
5. `smoke`
6. Canary steps (`5% -> 25% -> 100%` by default)
7. `switch_green` (final proxy switch)
8. `health`

If SLO breach is detected during canary, rollback runs immediately.

## Agent configuration
Main env variables:
- `UPDATE_GREEN_UP_CMD`
- `UPDATE_MIGRATE_SAFE_CMD`
- `UPDATE_SMOKE_CMD`
- `UPDATE_PROXY_SHIFT_CMD` (receives `UPDATE_CANARY_PERCENT`)
- `UPDATE_PROXY_SWITCH_GREEN_CMD`
- `UPDATE_ROLLBACK_CMD`
- `UPDATE_METRICS_URL`
- `UPDATE_CANARY_STEPS` (ex: `5,25,100`)
- `UPDATE_CANARY_STEP_WAIT_SEC`
- `UPDATE_SLO_P95_MAX`
- `UPDATE_SLO_ERROR_RATE_MAX`
- `UPDATE_SLO_WEBHOOK_RETRY_RATE_MAX`

## Control-plane
### Rollout strategy
New rollout strategies:
- `BATCH`
- `BLUE_GREEN_CANARY`

Stored per rollout:
- `canarySteps`
- `canaryStepWaitSec`
- SLO thresholds
- `autoRollback`

### UI
`/rollouts`:
- Schedule canary rollouts.
- Observe per-job canary metrics (`canaryPercent`, `p95`, `error rate`, `webhook retry`).

## Operational script
Manual command:
- `pnpm deploy:bluegreen`

Uses `scripts/blue-green-canary.mjs` and env-configured commands.
