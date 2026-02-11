# Updates & Rollout

## Overview
This system manages signed releases, channel-based rollouts (stable/beta), and agent-driven updates with automatic rollback.

## Release Manifests
Manifests are signed with HMAC-SHA256 and stored in the control-plane.

Required fields:
- `version` (semver)
- `sha` (git commit)
- `channel` (`stable` or `beta`)
- `migrations_required` (boolean)
- `breaking_changes` (string or null)
- `released_at` (ISO timestamp)
- `signature` (hex HMAC)

Generate a signed manifest:
```
RELEASE_SIGNING_SECRET=... pnpm release:manifest \
  --version 1.4.0 \
  --sha 0f00ba5 \
  --channel stable \
  --migrations-required true \
  --breaking-changes "Drops legacy orders API" \
  --out release-manifest.json
```

Upload to control-plane (admin):
```
curl -X POST http://control-plane.local/api/releases \
  -H "x-cp-admin-token: <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  --data @release-manifest.json
```

Control-plane verifies signatures with `CONTROL_PLANE_RELEASE_SIGNING_SECRET` (must match the signing secret).

## Rollouts
Rollouts are scheduled by channel with batches.

Create rollout:
```
curl -X POST http://control-plane.local/api/rollouts \
  -H "x-cp-admin-token: <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"manifestId":"<id>","channel":"stable","batchSize":5}'
```

Advance to next batch:
```
curl -X POST http://control-plane.local/api/rollouts/<id>/advance \
  -H "x-cp-admin-token: <ADMIN_TOKEN>"
```

## Agent Preflight + Update Flow
Agents poll `POST /api/updates/next` with a signed body. When a job is returned, they run:
1. backup
2. pull images
3. migrate
4. smoke
5. switch
6. confirm health

If any step fails, the agent runs `UPDATE_ROLLBACK_CMD` and reports `rolled_back`.

Agent requests are signed with HMAC-SHA256 using `AGENT_SECRET`. Control-plane validates using:
- `CONTROL_PLANE_AGENT_SECRETS` (per instance), or
- `CONTROL_PLANE_AGENT_TOKEN` (fallback)

Required env on the agent:
- `UPDATE_BACKUP_CMD`
- `UPDATE_PULL_CMD`
- `UPDATE_MIGRATE_CMD`
- `UPDATE_SMOKE_CMD`
- `UPDATE_SWITCH_CMD`
- `UPDATE_ROLLBACK_CMD` (optional but recommended)
- `UPDATE_HEALTHCHECK_URL` (optional)

## Runbook
### Batch stuck in progress
1. Check control-plane update jobs for `pending` or `in_progress`.
2. Verify agent connectivity and `CONTROL_PLANE_URL`.
3. If the agent is down, restart it and re-run the batch.

### Update fails at backup
1. Check `UPDATE_BACKUP_CMD` and access to DB credentials.
2. Re-run after fixing permissions or disk space.

### Update fails at migrate
1. Run the migration manually and inspect logs.
2. If incompatible, mark the rollout as paused and ship a fix.

### Update fails at smoke
1. Check `/health` and `/version` on the API.
2. Validate DB connectivity and cache.

### Health check fails after switch
1. Trigger rollback manually (if not automatic).
2. Investigate service logs for startup errors.

### Rollback fails
1. Manually execute the rollback command on the host.
2. If the release caused a schema change, restore from the last backup.
