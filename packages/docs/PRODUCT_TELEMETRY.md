# Product Telemetry / Telemetria de Producto

## ES

### Objetivo
Medir adopcion de features y detectar riesgo de churn por instalacion (empresa) sin recolectar PII.

### Evento canonical: `FeatureUsageEvent`
Se emite dentro del Event Model (`schemaVersion=1`) desde:
- Admin: vistas de modulos (POS, compras, campañas, plugins, etc.)
- Bot: ejecucion de comandos
- API (opcional): operaciones server-side relevantes (ARCA, integraciones, etc.)

Envelope: ver `packages/docs/EVENT_MODEL.md`.

Payload recomendado (minimo):
```json
{
  "feature": "pos",
  "action": "view",
  "pathname": "/pos"
}
```

### Agregacion y reporte al control-plane
1. La instancia guarda eventos en `EventLog`.
2. El agent consulta agregados de uso:
   - `GET /admin/events/feature-usage?from=<iso>&to=<iso>`
3. El agent envia `feature_usage` dentro del heartbeat (firmado HMAC).
4. El control-plane persiste `FeatureUsageSample` y lo muestra en dashboard.

### Dashboard control-plane
Ruta: `/product-telemetry`
- Adopcion: conteos por instalacion y top features.
- Señales churn (heuristicas):
  - `USAGE_DROP`: caida >= 50% vs periodo anterior (si el baseline era significativo)
  - `NO_USAGE`: 0 uso en el periodo
  - `RECURRING_ERRORS`: alerts `error` repetidos
  - `JOBS_FAILING`: job failures repetidos
  - `SEARCH_DOWN`: `searchOk=false` en heartbeat
- Playbooks: recomendaciones sugeridas (no ejecutan acciones).

### Notas de privacidad
- Evitar PII (emails, nombres, direcciones, chat ids, etc.).
- Ideal: solo claves de feature, accion y contexto tecnico (ruta/modulo).

## EN

### Goal
Measure feature adoption and detect churn risk per installation without collecting PII.

### Canonical event: `FeatureUsageEvent`
Emitted as part of the Event Model (`schemaVersion=1`) from:
- Admin: module views (POS, purchasing, campaigns, plugins, etc.)
- Bot: command executions
- API (optional): relevant server-side operations (ARCA, integrations, etc.)

See envelope in `packages/docs/EVENT_MODEL.md`.

Recommended minimal payload:
```json
{
  "feature": "pos",
  "action": "view",
  "pathname": "/pos"
}
```

### Aggregation and control-plane reporting
1. Instance stores canonical events in `EventLog`.
2. Agent queries usage aggregation:
   - `GET /admin/events/feature-usage?from=<iso>&to=<iso>`
3. Agent sends `feature_usage` inside signed heartbeat (HMAC).
4. Control-plane persists `FeatureUsageSample` and renders dashboards.

### Control-plane dashboard
Route: `/product-telemetry`
- Adoption: per-installation counts and top features.
- Churn signals (heuristics):
  - `USAGE_DROP`: >= 50% drop vs previous period (with meaningful baseline)
  - `NO_USAGE`: 0 usage in period
  - `RECURRING_ERRORS`: repeated `error` alerts
  - `JOBS_FAILING`: repeated job failures
  - `SEARCH_DOWN`: `searchOk=false` in heartbeat
- Playbooks: suggested recommendations only (no actions).

### Privacy notes
- Avoid PII (emails, names, addresses, chat ids, etc.).
- Prefer feature key + action + technical context (route/module).
