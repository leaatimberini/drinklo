# Operations Backup

This repo includes automated backups for Postgres, Redis (optional), and storage metadata.

## Components
- `scripts/backup.mjs`: creates a backup bundle.
- `scripts/restore.mjs`: validates hashes, restores DB, validates schema, runs smoke.
- `deploy/prod/docker-compose.yml`: `backup` service runs daily via cron.

## Backup contents
Each backup directory contains:
- `postgres.dump` (pg_dump -Fc)
- `redis.json` (optional, Redis key dumps)
- `storage-metadata.json` (optional, S3 list export)
- `manifest.json` + `manifest.sha256`
- If encryption enabled: `*.enc` files

## Backup env vars
- `BACKUP_DIR` (default `./backups`)
- `BACKUP_RETENTION_DAYS` (default `30`)
- `BACKUP_ENCRYPTION_KEY` (optional, enables AES-256-GCM)
- `BACKUP_REDIS` (`true`/`false`)
- `BACKUP_STORAGE` (`true`/`false`)

## Cron (prod)
The `backup` service runs daily at 03:00 UTC using `deploy/prod/backup/crontab`.

## Run backup manually
From repo root:
```
pnpm backup:run
```

## Restore
Set the backup folder via `BACKUP_ID` or `BACKUP_PATH` and run:
```
BACKUP_ID=20260211-030000 pnpm restore:run
```

Restore behavior:
- Validates file hashes from `manifest.json`.
- Decrypts files if `BACKUP_ENCRYPTION_KEY` is set.
- Restores Postgres via `pg_restore`.
- Restores Redis if `REDIS_RESTORE=true`.
- Validates Prisma schema diff.
- Runs `pnpm smoke`.

## Diagnostic bundle
Admin endpoint:
- `GET /admin/ops/diagnostic?limit=50`

Includes last request logs, errors, job failures, and safe config/version metadata.

## Notes
- Ensure `pg_dump`, `pg_restore`, and `redis-cli` are available in the environment running backups.
- Redis restore is optional and uses `RESTORE` + `FLUSHALL`.
- Storage metadata export only lists objects; it does not copy object contents.
