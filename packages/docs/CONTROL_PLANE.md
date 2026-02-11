# Control Plane

## Overview
Provider-facing control plane for monitoring installations with a separate database.

## App
- `apps/control-plane` (Next.js)
- DB: `CONTROL_PLANE_DATABASE_URL`

## Models
- `Installation`: instance registry
- `Alert`: alerts per installation
- `JobFailure`: failed jobs per installation

## Heartbeats
Endpoint:
- `POST /api/heartbeats`

Payload example:
Requires header:
```
x-agent-signature: <hex-hmac-sha256>
```
{
  "instance_id": "acme-001",
  "domain": "acme.com",
  "client": "Acme SA",
  "version": "1.2.3",
  "release_channel": "stable",
  "health": "ok",
  "backup_status": "ok",
  "last_backup_at": "2026-02-11T02:00:00Z",
  "alerts": [{"level":"warning","message":"Low disk"}],
  "job_failures": [{"queue":"billing","message":"Timeout"}]
}
```

## RBAC
Roles:
- `support`
- `ops`
- `admin`

Auth uses token cookies set in `/login` and verified against env:
- `CONTROL_PLANE_SUPPORT_TOKEN`
- `CONTROL_PLANE_OPS_TOKEN`
- `CONTROL_PLANE_ADMIN_TOKEN`
- `CONTROL_PLANE_AGENT_SECRETS` (JSON map: `{ "instance_id": "secret" }`)
- `CONTROL_PLANE_AGENT_TOKEN` (shared fallback secret)

Signing:
- Signature is `HMAC-SHA256(secret, raw_body)` in hex.
- Secret is resolved by `instance_id` via `CONTROL_PLANE_AGENT_SECRETS`, falling back to `CONTROL_PLANE_AGENT_TOKEN`.

## Views
- `/` list installations
- `/installations/[id]` details, alerts, job failures

## Releases & Rollouts
API endpoints:
- `POST /api/releases` (admin) stores a signed release manifest.
- `POST /api/rollouts` (admin) creates a rollout for a channel + batch size.
- `POST /api/rollouts/:id/advance` (admin) advances to the next batch.
- `POST /api/updates/next` (agent) fetches the next update job.
- `POST /api/updates/report` (agent) reports job status.

## SLOs
Heartbeats may include:
- `slo_p95_ms`
- `slo_error_rate`
- `slo_webhook_retry_rate`

Thresholds:
- `SLO_P95_MS_MAX`
- `SLO_ERROR_RATE_MAX`
- `SLO_WEBHOOK_RETRY_RATE_MAX`

Alerts can be forwarded via:
- `CONTROL_PLANE_ALERT_WEBHOOK_URL`
- `CONTROL_PLANE_ALERT_WEBHOOK_TOKEN`

## Backups & Restores
Endpoints:
- `POST /api/restores/schedule` (admin) schedule restore verifications.
- `POST /api/restores/report` (agent) report restore verification results.
- `GET /api/restores` (admin) list recent restore verifications.

## Plugin Marketplace
Endpoints:
- `GET /api/plugins/releases` (admin)
- `POST /api/plugins/releases` (admin)
- `POST /api/plugins/requests` (instance)
- `GET /api/plugins/requests/list` (admin)
- `POST /api/plugins/requests/:id/approve` (admin)
- `POST /api/plugins/rollouts` (admin)
- `POST /api/plugins/rollouts/:id/advance` (admin)
- `POST /api/plugins/next` (agent)
- `POST /api/plugins/report` (agent)

## Setup
1. Set `CONTROL_PLANE_DATABASE_URL`.
2. Run Prisma migrations for control-plane DB.
3. Set role tokens in env.
4. Start app: `pnpm --filter @erp/control-plane dev`.
