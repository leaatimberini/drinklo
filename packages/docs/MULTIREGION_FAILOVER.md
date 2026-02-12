# Multi-Region Failover

## ES

### Objetivo
Habilitar operación multi-región opcional con:
- Región primaria para escritura.
- Réplicas de lectura para reporting/BI.
- Fallback de lectura de catálogo en storefront.
- Failover manual asistido con scripts y checklist.

### Arquitectura recomendada
- `primary region`: API + DB primaria (read/write).
- `secondary region(s)`: API en modo lectura de catálogo + réplica DB read-only.
- `control-plane`: recibe heartbeats con health/latencia por región.
- `instance-agent`: sondea endpoints regionales y reporta estado.

### Variables nuevas
API (`apps/api/.env*`):
- `DATABASE_READ_REPLICA_URLS`: lista CSV de réplicas PostgreSQL para lecturas pesadas (ej. dashboard).

Storefront (`apps/storefront/.env*`):
- `NEXT_PUBLIC_API_URL`: endpoint primario.
- `NEXT_PUBLIC_API_READ_FALLBACK_URLS`: lista CSV de endpoints secundarios para lectura de catálogo.

Agent (`apps/instance-agent/.env.example`):
- `PRIMARY_REGION`: región primaria declarada.
- `REGIONAL_HEALTH_ENDPOINTS`: JSON array `[{"region":"sa-east-1","endpoint":"https://.../health"}]`.

Template deploy (`deploy/templates/.env.template`):
- incluye placeholders multi-región y fallback.

### Comportamiento implementado
- `apps/api`: `PrismaService` soporta clientes read-replica y `DashboardService` ejecuta lecturas sobre réplica si está configurada.
- `apps/api`: `/health` y `/health/regions` exponen estado de configuración de réplicas.
- `apps/storefront`: lecturas de catálogo (`categories/products/pdp`) intentan primario y luego secundarios.
- `apps/storefront`: cache edge por `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` para rutas de catálogo.
- `apps/instance-agent`: heartbeat incluye `primary_region` y `regional_health[]` con latencia.
- `apps/control-plane`: persiste y muestra estado regional por instalación.

### Failover manual asistido
Script:
- `pnpm failover:promote`

Configurar comandos por entorno:
- `FAILOVER_PRECHECK_CMD`
- `FAILOVER_PROMOTE_CMD`
- `FAILOVER_REPOINT_CMD`
- `FAILOVER_VERIFY_CMD`
- `FAILOVER_DRY_RUN=true|false`

Ejemplo:
```bash
FAILOVER_DRY_RUN=false \
FAILOVER_PRECHECK_CMD="psql ... -c 'select now()'" \
FAILOVER_PROMOTE_CMD="..." \
FAILOVER_REPOINT_CMD="..." \
FAILOVER_VERIFY_CMD="pnpm smoke" \
pnpm failover:promote
```

### Simulación en staging
Script:
- `pnpm failover:simulate`

Variables:
- `FAILOVER_PRIMARY_HEALTH_URL`
- `FAILOVER_SECONDARY_HEALTH_URL`
- `FAILOVER_STOREFRONT_URL`
- `FAILOVER_SMOKE_CMD` (opcional)

Test e2e (Playwright):
- `tests/e2e/multiregion-failover.spec.ts`
- Requiere `STAGING_SECONDARY_API_URL` y `STAGING_STOREFRONT_URL`.

### Checklist de promoción de réplica
1. Confirmar lag de replicación aceptable.
2. Congelar writes en primaria.
3. Promover réplica.
4. Reapuntar tráfico API/storefront/admin.
5. Ejecutar smoke + health + checkout crítico.
6. Mantener primaria vieja aislada hasta cierre de incidente.

---

## EN

### Goal
Enable optional multi-region operation with:
- Primary write region.
- Read replicas for reporting/BI.
- Storefront catalog read fallback to secondary regions.
- Assisted manual failover scripts and checklist.

### Recommended architecture
- `primary region`: API + primary DB (read/write).
- `secondary region(s)`: API for read-heavy traffic + read-only DB replica.
- `control-plane`: receives heartbeat latency/health per region.
- `instance-agent`: probes regional endpoints and reports status.

### New env vars
API (`apps/api/.env*`):
- `DATABASE_READ_REPLICA_URLS`: CSV list of PostgreSQL replica URLs for heavy reads.

Storefront (`apps/storefront/.env*`):
- `NEXT_PUBLIC_API_URL`: primary API endpoint.
- `NEXT_PUBLIC_API_READ_FALLBACK_URLS`: CSV list of secondary read endpoints.

Agent (`apps/instance-agent/.env.example`):
- `PRIMARY_REGION`
- `REGIONAL_HEALTH_ENDPOINTS` JSON array.

### Implemented behavior
- `apps/api`: read-replica support in `PrismaService`; dashboard summary queries use replica when configured.
- `apps/api`: `/health` and `/health/regions` include read-replica config status.
- `apps/storefront`: catalog reads fail over from primary to secondary endpoints.
- `apps/storefront`: edge caching headers for catalog routes.
- `apps/instance-agent`: heartbeat includes region-level health and latency.
- `apps/control-plane`: persists and renders regional status per installation.

### Assisted manual failover
- `pnpm failover:promote`
- Configure `FAILOVER_*` commands for precheck/promote/repoint/verify.

### Staging failover simulation
- `pnpm failover:simulate`
- Optional e2e check: `tests/e2e/multiregion-failover.spec.ts`.

### Replica promotion checklist
1. Validate replication lag.
2. Freeze writes in old primary.
3. Promote replica.
4. Repoint traffic.
5. Run smoke and critical flows.
6. Keep old primary isolated until incident closure.
