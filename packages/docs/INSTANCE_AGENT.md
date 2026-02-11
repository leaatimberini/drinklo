# Instance Agent

## Overview
Lightweight Node.js agent that runs beside each customer instance and reports heartbeats to the control-plane.

## Heartbeats
Sent every N minutes with:
- version
- uptime
- DB/Redis/Storage checks
- job failures count
- last backup timestamp
- secrets expired/unverified counts (from `/admin/ops`)

## Env vars
Required:
- `INSTANCE_ID`
- `CONTROL_PLANE_URL`
- `AGENT_SECRET`

Optional:
- `HEARTBEAT_INTERVAL_MIN` (default 5)
- `INSTANCE_DOMAIN`
- `INSTANCE_CLIENT`
- `INSTANCE_VERSION`
- `RELEASE_CHANNEL`
- `DATABASE_URL`
- `REDIS_URL`
- `STORAGE_ENDPOINT` or `STORAGE_PUBLIC_URL`
- `AGENT_OPS_URL` (e.g. `http://api:3001/admin/ops`)
- `AGENT_OPS_TOKEN` (admin JWT)
- `BACKUP_META_PATH` (JSON with `lastBackupAt`)
- `AGENT_PORT` (default 4010)
- `AGENT_LOCAL_TOKEN`
- `AGENT_METRICS_URL` (default `http://api:3001/metrics`)
- `PLUGIN_UPDATE_ENABLED` (default true)
- `PLUGIN_POLL_MIN` (default 10)
- `PLUGIN_STEP_TIMEOUT_SEC` (default 600)
- `PLUGIN_WORKDIR` (default current)
- `PLUGIN_INSTALL_CMD`
- `PLUGIN_UPDATE_CMD`
- `PLUGIN_REMOVE_CMD`
- `PLUGIN_SMOKE_CMD`
- `UPDATE_ENABLED` (default true)
- `UPDATE_POLL_MIN` (default 10)
- `UPDATE_STEP_TIMEOUT_SEC` (default 900)
- `UPDATE_WORKDIR` (default current)
- `UPDATE_BACKUP_CMD`
- `UPDATE_PULL_CMD`
- `UPDATE_MIGRATE_CMD`
- `UPDATE_SMOKE_CMD`
- `UPDATE_SWITCH_CMD`
- `UPDATE_HEALTHCHECK_URL`
- `UPDATE_ROLLBACK_CMD`

## Local endpoints
Protected with header `x-agent-local-token` if `AGENT_LOCAL_TOKEN` is set.
- `GET /health`
- `GET /diagnostic` (proxy to ops endpoint)
- `POST /smoke` (DB/Redis/Storage TCP checks)
- `GET /metrics` (proxy to API metrics)

## Updates
The agent polls `POST /api/updates/next` and, when a job is available, runs:
1. backup
2. pull images
3. migrate
4. smoke
5. switch
6. confirm health

If any step fails, it triggers `UPDATE_ROLLBACK_CMD` and reports status.

## Signing
Heartbeats are signed with HMAC-SHA256 using `AGENT_SECRET` and sent in `x-agent-signature` header. Control-plane validates using:
- `CONTROL_PLANE_AGENT_SECRETS` (per instance), or
- `CONTROL_PLANE_AGENT_TOKEN` (fallback shared secret)

## Tests
- Payload validation
- Signature verification

## Run
```
pnpm --filter @erp/instance-agent dev
```
