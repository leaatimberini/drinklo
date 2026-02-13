# Event Model

Canonical business events provide a single schema for tracking activity across storefront, admin, API, bot, and agent.

## Envelope

All events must follow this envelope (see `packages/shared/src/event-model.ts`):

- `id`: unique id (UUID recommended)
- `name`: canonical event name
- `schemaVersion`: number (current: `1`)
- `occurredAt`: ISO timestamp
- `source`: `storefront | admin | api | bot | agent`
- `companyId`: optional
- `subjectId`: optional (entity id)
- `payload`: freeform object

## Canonical Events (v1)

- `OrderCreated`: order created (API)
- `CheckoutStarted`: checkout screen opened (storefront)
- `ProductViewed`: product detail viewed (storefront)
- `CartUpdated`: cart change (storefront)
- `EmailSent`: email sent (API)
- `PromoApplied`: promo applied (storefront/admin)
- `FeatureUsageEvent`: product feature usage tracking (admin/bot/api)
- `BotCommand`: bot command executed (bot)
- `AgentHeartbeat`: instance agent heartbeat (agent)
- `DashboardViewed`: admin dashboard viewed (admin)

## Ingestion & Pipeline

- Clients send to `POST /events/ingest` with body `[EventEnvelope]`.
- Optional header: `x-event-token` (if `EVENT_INGEST_TOKEN` is set in API).
- API stores events in `EventLog` and (optionally) forwards the batch to `EVENT_SINK_URL`.
- Metrics: `GET /admin/events/stats` returns 1h totals, failures, and average lag.
- Schema info: `GET /events/schema` returns current `schemaVersion`.

## Examples

```json
{
  "id": "evt_123",
  "name": "ProductViewed",
  "schemaVersion": 1,
  "occurredAt": "2026-02-11T20:10:00.000Z",
  "source": "storefront",
  "companyId": "c1",
  "subjectId": "p1",
  "payload": {
    "productId": "p1",
    "sku": "SKU-001"
  }
}
```

## Adding New Events

1. Update `packages/shared/src/event-model.ts` with the new name.
2. Emit the event from the appropriate app/service.
3. Add/update contract tests for validation and backward compatibility.
4. Document the event and payload fields here.

## Notes

- Backward compatibility: events with `schemaVersion = 1` must remain valid when adding new optional fields.
- Keep payloads small and avoid PII unless required by the use case.
