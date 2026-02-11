# Backup & Restore

## Backup
```
BACKUP_PATH=./backups/erp.dump pnpm db:backup
```
- Uses `pg_dump -Fc` and `DATABASE_URL`.
- Requires PostgreSQL client tools installed (`pg_dump`).

## Restore
```
BACKUP_PATH=./backups/erp.dump pnpm db:restore
```
- Uses `pg_restore --clean --if-exists`.
- Requires PostgreSQL client tools installed (`pg_restore`).

## Env
- `DATABASE_URL`
- `BACKUP_PATH` (optional)

## Notes
- Ensure DB users have required privileges.
- Run in maintenance windows for large DBs.
