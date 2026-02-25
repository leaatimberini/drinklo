# Fleet Scaling / Escalado de Flota

## ES

### Objetivo
Optimizar operación para miles de instancias con:
- auto-tuning de workers/colas/cache
- cuotas técnicas por plan
- sharding lógico de métricas/eventos por `instance_id`
- simulación de estabilidad de flota (mock)

### Auto-tuning
Librería: `apps/control-plane/app/lib/fleet-scaling.ts`

Calcula recomendaciones por instancia usando señales:
- `monthlyOrders`
- `eventsTotal1h`
- `jobsProcessed1h`
- `jobsPending`
- CPU / memoria

Salida:
- workers API/jobs
- concurrencia de colas
- cache TTL + tamaño
- perfil (`xs/s/m/l/xl`)

### Cuotas técnicas por plan
Planes normalizados:
- `starter`
- `pro` (fallback)
- `enterprise`

Cuotas v1:
- `jobsPerMin`
- `apiCallsPerMin`
- `eventsPerMin`
- `storageGb`
- `webhooksPerMin`

Aplicación:
- Heartbeat (`/api/heartbeats`) evalúa quotas y devuelve `fleetScaling`.
- Si excede, genera alerta en control-plane (dedupe temporal).

### Sharding lógico (control-plane)
Se agrega `shardKey` (hash de `instance_id`) para particionar y consultar por shard en tablas de alto volumen:
- `WebVitalSample`
- `FeatureUsageSample`
- `IntegrationBuilderReport`

Uso:
- índices por `(shardKey, capturedAt)`
- distribución visible en `/fleet-scaling`

### API/UI
- `GET /api/fleet-scaling/overview`
- `POST /api/fleet-scaling/simulate`
- UI: `/fleet-scaling`

### Tests
`apps/control-plane/app/lib/fleet-scaling.test.ts`
- fallback de plan
- cuotas
- distribución de shard balanceada
- simulación con miles de instancias
- forma de recomendaciones de tuning

## EN

### Goal
Optimize operations for thousands of instances with:
- auto-tuning of workers/queues/cache
- technical quotas by plan
- logical sharding of metrics/events by `instance_id`
- mock fleet stability simulation

### Auto-tuning
Implemented in `apps/control-plane/app/lib/fleet-scaling.ts`.

Signals:
- monthly orders
- events/jobs throughput
- queue backlog
- CPU/memory

Outputs:
- API/job worker counts
- queue concurrency
- cache TTL/capacity
- size profile (`xs/s/m/l/xl`)

### Technical quotas by plan
Normalized plans:
- `starter`
- `pro` (fallback)
- `enterprise`

Quota metrics v1:
- `jobsPerMin`
- `apiCallsPerMin`
- `eventsPerMin`
- `storageGb`
- `webhooksPerMin`

Enforcement:
- `/api/heartbeats` evaluates quotas and returns `fleetScaling`.
- Violations create deduped control-plane alerts.

### Logical sharding
Added `shardKey` (hash of `instance_id`) to high-volume metrics/event tables:
- `WebVitalSample`
- `FeatureUsageSample`
- `IntegrationBuilderReport`

This enables shard-based querying and hotspot visibility.

### API/UI
- `GET /api/fleet-scaling/overview`
- `POST /api/fleet-scaling/simulate`
- UI page: `/fleet-scaling`

