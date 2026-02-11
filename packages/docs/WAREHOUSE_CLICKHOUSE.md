# Warehouse (ClickHouse)

Este módulo agrega un data warehouse self-hosted con ClickHouse y una capa de BI avanzada.

## Objetivo

- ClickHouse como destino primario para reportes pesados.
- Opciones alternativas (BigQuery / Redshift) documentadas como destinos secundarios.
- ETL/ELT desde Postgres para cohortes, retención, LTV y RFM.

## Docker (local)

El `docker-compose.yml` incluye ClickHouse:

```
clickhouse:
  image: clickhouse/clickhouse-server:24.8
  ports:
    - "8123:8123"
    - "9000:9000"
```

## Variables de entorno (API)

```
WAREHOUSE_PROVIDER=clickhouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DB=erp_warehouse
CLICKHOUSE_USER=erp
CLICKHOUSE_PASSWORD=erp
```

## ETL

- Job diario: `02:30` (America/Argentina/Buenos_Aires).
- Manual: `POST /admin/bi/etl/run` (roles: `admin` o `support`).
- Tablas creadas automáticamente en ClickHouse:
  - `orders` con totales por orden (ARS).

## Endpoints BI

Todos bajo `admin/bi` y requieren JWT:

- `GET /admin/bi/cohorts?from&to`
- `GET /admin/bi/retention?from&to`
- `GET /admin/bi/ltv?from&to`
- `GET /admin/bi/rfm?from&to`

Los filtros `from` y `to` deben estar en ISO (se usa BA para el UI).

## Admin UI

Ruta: `/bi`

Incluye:
- Cohortes
- Retención 30 días
- LTV
- RFM (Top clientes)

## BigQuery / Redshift (alternativo)

Actualmente se documenta como opción (no implementado):

- **BigQuery**: usar dataset por empresa y cargar desde ETL con `MERGE` por `order_id`.
- **Redshift**: usar `COPY` desde S3/MinIO y `upsert` por `order_id`.

Si necesitás activarlo:
1. Definir `WAREHOUSE_PROVIDER=bigquery` o `WAREHOUSE_PROVIDER=redshift`.
2. Implementar el adaptador en `apps/api/src/modules/warehouse`.

## Integridad ETL

Tests en `apps/api/src/modules/warehouse/warehouse.service.spec.ts` validan los totales y formatos básicos.
