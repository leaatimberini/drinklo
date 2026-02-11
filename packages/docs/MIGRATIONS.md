# Migrations Strategy

## Pre-check
- Run diff check to detect schema mismatch:
```
pnpm -C packages/db prisma migrate diff --from-migrations --to-schema-datamodel --exit-code
```
- In production, API startup will **fail** if mismatch is detected.

## Apply
```
pnpm -C packages/db migrate
```
- Use `prisma migrate deploy` in CI/production if needed.

## Rollback Plan
- Prisma does not support automatic down migrations.
- Rollback strategy:
  1. Restore DB from backup.
  2. Re-deploy previous app version.

## Operational Notes
- Take a backup before applying migrations.
- Use maintenance windows for large schema changes.
- Verify app health after apply.

## Files
- `scripts/schema-check.mjs`
- `apps/api/src/main.ts`
