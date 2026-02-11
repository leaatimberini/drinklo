# Observability

## Logging
- API logs requests in JSON with: `requestId`, `userId`, `companyId`, `route`, `durationMs`, `status`.
- Bot logs each update in JSON with `requestId`, `chatId`, `userId`, `route`, `durationMs`, `status`.

## Request ID
- Middleware sets `x-request-id` on every response.
- Incoming `x-request-id` is respected.

## OpenTelemetry
- Basic node auto-instrumentation + BullMQ instrumentation (if present).
- Configure exporter with env vars:
  - `OTEL_EXPORTER_OTLP_ENDPOINT`

## Error Capture (Sentry)
- Enable with `SENTRY_DSN`.
- Scrubs headers `authorization` and `cookie`, and redacts `password|token|secret` fields.

## Ops Dashboard
- `GET /admin/ops` (admin only) returns last errors and job failures.

## Files
- `apps/api/src/observability/*`
- `apps/api/src/modules/ops/*`
- `apps/api/src/main.ts`
- `apps/bot/src/index.ts`
