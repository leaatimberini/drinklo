# FinOps (ES/EN)

## ES

### Objetivo
Agregar visibilidad de costo operativo por instancia y alertas tempranas de consumo anómalo.

### Qué reporta el `instance-agent`
En cada heartbeat (`/api/heartbeats`), el agent envía:
- CPU: `cpu_usage_pct`
- Memoria: `memory_used_bytes`, `memory_total_bytes`
- Disco: `disk_used_bytes`, `disk_total_bytes`
- Red: `network_rx_bytes`, `network_tx_bytes`
- DB: `db_size_bytes` (query `pg_database_size`)
- Storage: `storage_size_bytes` (path local configurable)
- Jobs: `jobs_failed`, `jobs_processed_1h`, `jobs_pending`

Variables útiles en agent:
- `STORAGE_DATA_PATH`: carpeta para estimar tamaño de storage local.
- `AGENT_DB_SIZE_CMD`: override opcional para calcular DB size.
- `AGENT_STORAGE_SIZE_CMD`: override opcional para storage size.
- `AGENT_NETWORK_STATS_CMD`: override opcional para red.
- `AGENT_SYSTEM_ROOT_PATH`: root para `statfs` (disco).

### Control-plane: cálculo de costo estimado
Se usa tabla configurable `FinOpsPricing` (USD por unidad):
- `cpu_vcpu_hour`
- `memory_gb_hour`
- `disk_gb_month`
- `network_gb`
- `db_gb_month`
- `storage_gb_month`
- `jobs_1k`

Cada heartbeat guarda:
- Snapshot (`FinOpsSnapshot`)
- Costo horario estimado (`FinOpsCostRecord`)
- Últimos valores agregados en `Installation`

Dashboard: `Control Plane -> /finops`
- Vista por instancia
- Edición de tabla de costos
- Alertas FinOps
- Export CSV: `/api/finops/export`

### Alertas automáticas
Se crean en `Alert` con prefijo `FinOps anomaly:`
- crecimiento anómalo DB
- storage runaway
- network runaway
- DB bloat (ratio DB/disco usado)

Thresholds por env:
- `FINOPS_DB_GROWTH_ALERT_PCT` (default: `25`)
- `FINOPS_STORAGE_GROWTH_ALERT_PCT` (default: `25`)
- `FINOPS_NETWORK_RUNAWAY_GB_PER_HOUR` (default: `5`)
- `FINOPS_DB_BLOAT_RATIO_TO_DISK_USED` (default: `0.75`)

---

## EN

### Goal
Add per-instance operational cost visibility and early alerts for anomalous consumption.

### What `instance-agent` reports
On each heartbeat (`/api/heartbeats`), the agent sends:
- CPU: `cpu_usage_pct`
- Memory: `memory_used_bytes`, `memory_total_bytes`
- Disk: `disk_used_bytes`, `disk_total_bytes`
- Network: `network_rx_bytes`, `network_tx_bytes`
- DB: `db_size_bytes` (`pg_database_size` query)
- Storage: `storage_size_bytes` (configurable local path)
- Jobs: `jobs_failed`, `jobs_processed_1h`, `jobs_pending`

Useful agent env vars:
- `STORAGE_DATA_PATH`
- `AGENT_DB_SIZE_CMD`
- `AGENT_STORAGE_SIZE_CMD`
- `AGENT_NETWORK_STATS_CMD`
- `AGENT_SYSTEM_ROOT_PATH`

### Control-plane estimated cost
A configurable `FinOpsPricing` table (USD per unit) is used:
- `cpu_vcpu_hour`
- `memory_gb_hour`
- `disk_gb_month`
- `network_gb`
- `db_gb_month`
- `storage_gb_month`
- `jobs_1k`

Each heartbeat stores:
- Snapshot (`FinOpsSnapshot`)
- Estimated hourly cost record (`FinOpsCostRecord`)
- Latest aggregated values in `Installation`

Dashboard: `Control Plane -> /finops`
- Per-instance view
- Cost table editor
- FinOps alerts
- CSV export: `/api/finops/export`

### Automatic alerts
Alerts are written into `Alert` prefixed with `FinOps anomaly:`
- anomalous DB growth
- storage runaway
- network runaway
- DB bloat (DB/used-disk ratio)

Env thresholds:
- `FINOPS_DB_GROWTH_ALERT_PCT` (default: `25`)
- `FINOPS_STORAGE_GROWTH_ALERT_PCT` (default: `25`)
- `FINOPS_NETWORK_RUNAWAY_GB_PER_HOUR` (default: `5`)
- `FINOPS_DB_BLOAT_RATIO_TO_DISK_USED` (default: `0.75`)

