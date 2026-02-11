# Fleet Backups & Restore Verification

## Overview
Every instance writes backup metadata locally. The instance agent includes it in heartbeats so the control-plane can track fleet-wide backup status.

## Backup Metadata
`scripts/backup.mjs` writes `BACKUP_META_PATH` (default `BACKUP_DIR/last_backup.json`) with:
- `backupId`
- `createdAt`
- `sizeBytes`
- `checksum` (manifest SHA256)
- `bucket` (optional)
- `path`
- `instanceId`

The instance agent sends:
- `last_backup_at`
- `backup_id`
- `backup_size_bytes`
- `backup_checksum`
- `backup_bucket`
- `backup_path`

Control-plane stores each backup in `BackupRecord`.

## Restore Verification (Weekly)
The control-plane schedules restore verification for N instances:
- `POST /api/restores/schedule` (admin)

It skips instances already scheduled in the last 7 days.

### Scheduler
Run weekly (Windows Task Scheduler or cron):
```
RESTORE_VERIFY_COUNT=5 RESTORE_VERIFY_ENV=staging pnpm restore:verify:schedule
```

### Runner
An isolated staging runner should:
1. Pick scheduled `RestoreVerification` entries (status `scheduled`).
2. Restore backup into staging (use `scripts/restore.mjs`).
3. Run `pnpm smoke` and schema checks.
4. Report status:
```
POST /api/restores/report
Headers: x-agent-signature
Body: { instance_id, restore_id, status, message, meta }
```

Statuses:
- `verified` (success)
- `failed` (alerted)
- `skipped`

## Alerts
On `failed`, control-plane:
- stores an `Alert`
- notifies `CONTROL_PLANE_ALERT_WEBHOOK_URL` if configured

## Env Vars
API backup:
- `BACKUP_DIR`, `BACKUP_META_PATH`, `BACKUP_BUCKET`, `BACKUP_RETENTION_DAYS`

Control-plane:
- `CONTROL_PLANE_ALERT_WEBHOOK_URL`
- `CONTROL_PLANE_ALERT_WEBHOOK_TOKEN`
