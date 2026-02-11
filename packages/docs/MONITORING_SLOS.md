# Monitoring & SLOs

## Metrics
The API exposes Prometheus metrics at:
- `GET /metrics`

The instance agent proxies those metrics at:
- `GET /metrics` (agent)

Key metrics:
- `http_request_duration_ms` (summary with p95)
- `http_requests_total` (labels: method, route, status)
- `webhooks_total` (labels: provider, status)
- `webhook_retries_total` (labels: provider)
- `jobs_failed_total`
- `jobs_failed_current`
- `db_pool_active`, `db_pool_idle`, `db_pool_total`

## Agent -> Control-Plane SLOs
The agent scrapes metrics and sends SLO fields in heartbeats:
- `slo_p95_ms`
- `slo_error_rate`
- `slo_webhook_retry_rate`
- `slo_updated_at`

## Control-Plane Alerts
Set thresholds in `apps/control-plane/.env`:
- `SLO_P95_MS_MAX`
- `SLO_ERROR_RATE_MAX`
- `SLO_WEBHOOK_RETRY_RATE_MAX`

When thresholds are exceeded, control-plane:
- stores an alert
- sends a webhook notification (if configured)

Notification env:
- `CONTROL_PLANE_ALERT_WEBHOOK_URL`
- `CONTROL_PLANE_ALERT_WEBHOOK_TOKEN` (optional Bearer)

## Dashboard (Provider)
The control-plane list shows per instance:
- p95 latency
- error rate
- webhook retry rate

## Runbook
### High p95 latency
1. Check API `/metrics` for spikes by route.
2. Validate DB pool usage metrics.
3. Review recent deployments and run smoke.

### High error rate
1. Inspect `/admin/ops` errors.
2. Check recent webhook failures.
3. Roll back if regressions are confirmed.

### High webhook retry rate
1. Validate webhook signatures and credentials.
2. Check outbound connectivity and firewall rules.
3. Inspect webhook logs for duplicates and errors.
