# Integration Builder

## ES

## Objetivo
Crear conectores simples configurables sin código:
- `source event` -> `transform (mapping JSON)` -> `destination webhook/API`
- retries con backoff
- DLQ
- preview de payload
- secrets por conector (integrado con `SecretsService`)
- logs y métricas por conector
- visibilidad en control-plane

## Arquitectura (instancia/API)

### Modelos
- `IntegrationConnector`
  - define evento fuente, destino, auth, mapping, timeout y retries
- `IntegrationConnectorDelivery`
  - cola + log de entregas
  - estados: `PENDING`, `PROCESSING`, `RETRY_SCHEDULED`, `SUCCESS`, `FAILED`, `DLQ`

### Flujo
1. `EventsService` persiste `EventLog`.
2. Si hay conectores activos para `event.name`, crea `IntegrationConnectorDelivery` (`PENDING`).
3. Worker interno (polling cada ~2s) procesa entregas pendientes.
4. Si falla:
   - reintenta con backoff exponencial (`base * 2^(attempt-1)`)
   - al agotar intentos -> `DLQ`
5. Se guardan logs, payload, headers, response/error y duración.

## Mapping JSON
Reglas soportadas:
- strings `$.<path>` => resuelve desde el evento completo
- placeholders `{{event.path}}`
- placeholders `{{secret.path}}`
- objetos/arrays recursivos

Ejemplo:
```json
{
  "eventId": "$.id",
  "orderId": "$.payload.orderId",
  "auth": "Bearer {{secret.token}}"
}
```

## Secrets por connector
Cada conector usa un provider derivado:
- `INTEGRATION_BUILDER_CONNECTOR:<connectorId>`

Se gestionan por endpoint del builder y quedan auditados vía `SecretsService` / `SecretAudit`.

## Endpoints API (admin)
- `GET /admin/integration-builder/connectors`
- `PUT /admin/integration-builder/connectors`
- `DELETE /admin/integration-builder/connectors/:id`
- `POST /admin/integration-builder/preview`
- `POST /admin/integration-builder/connectors/:id/secret`
- `GET /admin/integration-builder/connectors/:id/logs`
- `GET /admin/integration-builder/connectors/:id/metrics`
- `GET /admin/integration-builder/metrics`
- `POST /admin/integration-builder/connectors/:id/retry-dlq`
- `POST /admin/integration-builder/report-control-plane`

## UI Admin
- `apps/admin/app/integration-builder/page.tsx`
  - edición de conectores (JSON)
  - preview de payload
  - carga de secret por conector
  - logs y métricas
  - retry de DLQ

## Control-plane

### Ingest
- `POST /api/integration-builder/report`
  - auth: `x-cp-ingest-token`

Persistencia:
- `IntegrationBuilderReport`

### Dashboard
- `apps/control-plane/app/integration-builder/page.tsx`
  - conectores activos/total
  - success/failure 24h
  - DLQ open

## Retries, Backoff y DLQ
- `retryMaxAttempts`
- `retryBackoffBaseMs`
- backoff exponencial con tope implícito por configuración
- DLQ = entregas en estado `DLQ`
- requeue manual por conector: `retry-dlq`

## Tests
- `integration-builder.mapping.spec.ts`
  - mapping + placeholders
  - backoff
- `integration-builder.service.spec.ts`
  - retry scheduling
  - DLQ final

## Limitaciones actuales
- Destino soporta HTTP webhook/API (fetch). No SDKs específicos.
- Preview es de payload/request (no ejecuta llamada real).
- Worker es polling en DB (simple y portable); se puede migrar a BullMQ si se requiere throughput alto.

---

## EN

## Goal
Provide a no-code/simple connector builder:
- `source event` -> `JSON mapping transform` -> `destination webhook/API`
- retries with backoff
- DLQ
- payload preview
- per-connector secrets (via `SecretsService`)
- logs and metrics per connector
- control-plane visibility

## Instance/API architecture
- `IntegrationConnector`: connector config
- `IntegrationConnectorDelivery`: queue + delivery log
- `EventsService` enqueues deliveries when matching events are stored
- background polling worker processes pending deliveries, retries failures, and moves exhausted jobs to DLQ

## Mapping JSON
Supports:
- `$.path` extraction from event
- `{{event.path}}` interpolation
- `{{secret.path}}` interpolation
- recursive objects/arrays

## Admin API endpoints
- list/upsert/delete connectors
- preview payload
- rotate connector secret
- logs/metrics
- retry DLQ

## Admin UI
- `apps/admin/app/integration-builder/page.tsx`

## Control-plane
- ingest endpoint: `POST /api/integration-builder/report`
- dashboard page: `apps/control-plane/app/integration-builder/page.tsx`
- storage model: `IntegrationBuilderReport`

## Tests
- mapping + backoff
- retry + DLQ behavior

